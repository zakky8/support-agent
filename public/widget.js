(function () {
  const styles = `
    .support-widget-container {
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 9999;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    .support-widget-toggle {
      width: 60px;
      height: 60px;
      border-radius: 50%;
      background-color: var(--widget-color, #0066ff);
      color: white;
      border: none;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      cursor: pointer;
      display: flex;
      justify-content: center;
      align-items: center;
      transition: transform 0.2s;
    }
    .support-widget-toggle:hover {
      transform: scale(1.05);
    }
    .support-widget-window {
      position: absolute;
      bottom: 80px;
      right: 0;
      width: 350px;
      height: 500px;
      background: white;
      border-radius: 12px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.15);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      opacity: 0;
      pointer-events: none;
      transform: translateY(20px);
      transition: opacity 0.3s, transform 0.3s;
    }
    .support-widget-window.open {
      opacity: 1;
      pointer-events: all;
      transform: translateY(0);
    }
    .support-widget-header {
      background-color: var(--widget-color, #0066ff);
      color: white;
      padding: 16px;
      font-weight: bold;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .support-widget-messages {
      flex: 1;
      padding: 16px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 12px;
      background: #f9f9f9;
    }
    .support-message {
      max-width: 80%;
      padding: 10px 14px;
      border-radius: 16px;
      font-size: 14px;
      line-height: 1.4;
      word-wrap: break-word;
    }
    .support-message.user {
      align-self: flex-end;
      background-color: var(--widget-color, #0066ff);
      color: white;
      border-bottom-right-radius: 4px;
    }
    .support-message.agent {
      align-self: flex-start;
      background-color: #e5e5ea;
      color: black;
      border-bottom-left-radius: 4px;
    }
    .support-widget-input-area {
      padding: 12px;
      background: white;
      border-top: 1px solid #eee;
      display: flex;
      gap: 8px;
    }
    .support-widget-input {
      flex: 1;
      padding: 10px;
      border: 1px solid #ccc;
      border-radius: 20px;
      outline: none;
      font-size: 14px;
    }
    .support-widget-input:focus {
      border-color: var(--widget-color, #0066ff);
    }
    .support-widget-send {
      background-color: var(--widget-color, #0066ff);
      color: white;
      border: none;
      border-radius: 50%;
      width: 40px;
      height: 40px;
      cursor: pointer;
      display: flex;
      justify-content: center;
      align-items: center;
    }
    .support-widget-send:disabled {
      background-color: #ccc;
      cursor: not-allowed;
    }
    .support-typing {
      align-self: flex-start;
      background-color: transparent;
      color: #666;
      font-size: 12px;
      font-style: italic;
      display: none;
    }
    .support-typing.active {
      display: block;
    }
  `;

  class SupportWidget {
    constructor(config) {
      this.apiUrl = config.apiUrl || '';
      this.wsUrl = this.apiUrl.replace(/^http/, 'ws') + '/ws/chat';
      this.themeColor = config.themeColor || '#0066ff';
      this.botName = config.botName || 'Support Agent';
      this.isOpen = false;
      this.socket = null;
      this.isConnected = false;

      this.init();
    }

    init() {
      // Inject styles
      const styleTag = document.createElement('style');
      styleTag.innerHTML = styles;
      document.head.appendChild(styleTag);

      // Create container
      this.container = document.createElement('div');
      this.container.className = 'support-widget-container';
      this.container.style.setProperty('--widget-color', this.themeColor);

      // Create toggle button
      this.toggleBtn = document.createElement('button');
      this.toggleBtn.className = 'support-widget-toggle';
      this.toggleBtn.innerHTML = `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        </svg>
      `;
      this.toggleBtn.onclick = () => this.toggleWindow();

      // Create chat window
      this.window = document.createElement('div');
      this.window.className = 'support-widget-window';
      this.window.innerHTML = `
        <div class="support-widget-header">
          <span>${this.botName}</span>
          <button style="background:none;border:none;color:white;cursor:pointer;" id="sw-close">✖</button>
        </div>
        <div class="support-widget-messages" id="sw-messages">
          <div class="support-message agent">Hi there! How can I help you today?</div>
          <div class="support-typing" id="sw-typing">Agent is typing...</div>
        </div>
        <div class="support-widget-input-area">
          <input type="text" class="support-widget-input" id="sw-input" placeholder="Type a message..." />
          <button class="support-widget-send" id="sw-send">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
          </button>
        </div>
      `;

      this.container.appendChild(this.window);
      this.container.appendChild(this.toggleBtn);
      document.body.appendChild(this.container);

      // Bind events
      document.getElementById('sw-close').onclick = () => this.toggleWindow();
      const input = document.getElementById('sw-input');
      const sendBtn = document.getElementById('sw-send');

      input.onkeypress = (e) => {
        if (e.key === 'Enter') this.sendMessage();
      };
      sendBtn.onclick = () => this.sendMessage();
    }

    connectWebSocket() {
      if (this.socket || this.isConnected) return;

      this.socket = new WebSocket(this.wsUrl);

      this.socket.onopen = () => {
        this.isConnected = true;
      };

      this.socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        const typingIndicator = document.getElementById('sw-typing');

        if (data.type === 'typing') {
          typingIndicator.classList.toggle('active', data.isTyping);
          this.scrollToBottom();
        } else if (data.type === 'message') {
          typingIndicator.classList.remove('active');
          this.addMessage(data.reply, 'agent');
        } else if (data.type === 'error') {
          typingIndicator.classList.remove('active');
          this.addMessage('Sorry, I encountered an error. Please try again.', 'agent');
        }
      };

      this.socket.onclose = () => {
        this.isConnected = false;
        this.socket = null;
        setTimeout(() => {
          if (this.isOpen) this.connectWebSocket();
        }, 3000);
      };
    }

    toggleWindow() {
      this.isOpen = !this.isOpen;
      if (this.isOpen) {
        this.window.classList.add('open');
        document.getElementById('sw-input').focus();
        this.connectWebSocket();
      } else {
        this.window.classList.remove('open');
      }
    }

    addMessage(text, sender) {
      const messagesContainer = document.getElementById('sw-messages');
      const typingIndicator = document.getElementById('sw-typing');
      const msgDiv = document.createElement('div');
      msgDiv.className = \`support-message \${sender}\`;
      
      // Simple markdown parser for bold and line breaks
      let formattedText = text
        .replace(/\\*\\*(.*?)\\*\\*/g, '<strong>$1</strong>')
        .replace(/\\n/g, '<br/>');
        
      msgDiv.innerHTML = formattedText;
      messagesContainer.insertBefore(msgDiv, typingIndicator);
      this.scrollToBottom();
    }

    scrollToBottom() {
      const messagesContainer = document.getElementById('sw-messages');
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    sendMessage() {
      const input = document.getElementById('sw-input');
      const text = input.value.trim();
      if (!text) return;

      this.addMessage(text, 'user');
      input.value = '';

      if (this.isConnected) {
        this.socket.send(JSON.stringify({ message: text }));
      } else {
        // Fallback to REST API if WS is down
        this.sendRestMessage(text);
      }
    }

    async sendRestMessage(text) {
      const typingIndicator = document.getElementById('sw-typing');
      typingIndicator.classList.add('active');
      this.scrollToBottom();

      try {
        const response = await fetch(\`\${this.apiUrl}/api/chat\`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: text }),
        });
        const data = await response.json();
        typingIndicator.classList.remove('active');
        this.addMessage(data.reply, 'agent');
      } catch (err) {
        typingIndicator.classList.remove('active');
        this.addMessage('Sorry, I encountered a network error. Please try again.', 'agent');
      }
    }
  }

  // Expose globally
  window.SupportWidget = {
    init: (config) => new SupportWidget(config),
  };
})();
