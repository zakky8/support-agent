# Support Agent Framework

An advanced, multi-channel AI Customer Support Agent built with TypeScript. It natively supports Website widgets, Telegram bots, and Discord bots using a central "Brain" equipped with RAG (Retrieval-Augmented Generation) and Tool Calling.

## Features
- **Multi-Channel:** Respond to users on your Website, Telegram, and Discord simultaneously.
- **RAG Knowledge Base:** Drop `.md` or `.txt` files into the `knowledge/` directory, and the agent will automatically search them before answering.
- **Tool Calling:** The agent can use tools to search knowledge, get session context, or escalate tickets to a human.
- **Human Handoff:** Users can type `/human` or `!human`, or the AI can automatically escalate if it detects a complex issue or low confidence.
- **Session Memory:** Remembers context per user per channel.

## Getting Started

1. Clone the repository
2. Install dependencies: `npm install`
3. Copy `.env.example` to `.env` and fill in your API keys (Google Gemini or OpenAI).
4. Add your knowledge documents to the `knowledge/` folder.
5. Ingest knowledge: `npm run ingest`
6. Start the agent: `npm start` (or `npm run dev` for development)

## Connecting Channels

### Website Widget
The web server runs on port 3000 by default. Include this snippet on your website:
```html
<script src="http://localhost:3000/widget.js"></script>
<script>
  window.SupportWidget.init({
    apiUrl: 'http://localhost:3000',
    themeColor: '#0066ff',
    botName: 'Atlas Support',
  });
</script>
```
Visit `http://localhost:3000` to see the demo page.

### Telegram
Talk to BotFather on Telegram, create a new bot, get the token, and add it to `.env` as `TELEGRAM_BOT_TOKEN`. Ensure `TELEGRAM_ENABLED=true`.

### Discord
Create a New Application in the [Discord Developer Portal](https://discord.com/developers/applications). Enable the "Message Content Intent". Get the Bot Token and add it to `.env` as `DISCORD_BOT_TOKEN`. Ensure `DISCORD_ENABLED=true`.

*Note: Discord Self-Bots (using a personal account) are against Discord ToS and are not supported by this framework. Please use official Bot tokens.*
