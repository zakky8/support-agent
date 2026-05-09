// ─────────────────────────────────────────────────────────
// Discord Channel — discord.js Bot Connector
// Forwards Discord messages to the central agent brain.
// Supports both DMs and channel mentions.
// ─────────────────────────────────────────────────────────

import {
  Client,
  GatewayIntentBits,
  Partials,
  Events,
  Message as DiscordMessage,
  ActivityType,
  EmbedBuilder,
} from 'discord.js';
import { config } from '../../config';
import { processMessage } from '../../agent/brain';
import { memory } from '../../agent/memory';
import { logger } from '../../utils/logger';

let client: Client | null = null;

export function createDiscordBot(): Client {
  if (!config.discord.botToken) {
    throw new Error('DISCORD_BOT_TOKEN is not set in environment variables');
  }

  client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.DirectMessages,
      GatewayIntentBits.MessageContent,
    ],
    partials: [Partials.Channel, Partials.Message],
  });

  // ── Bot Ready ───────────────────────────────────────
  client.on(Events.ClientReady, (readyClient) => {
    logger.info(`🎮 Discord bot logged in as ${readyClient.user.tag}`);
    readyClient.user.setActivity(`${config.agent.company} Support`, {
      type: ActivityType.Watching,
    });
  });

  // ── Message Handler ─────────────────────────────────
  client.on(Events.MessageCreate, async (msg: DiscordMessage) => {
    // Ignore bot messages
    if (msg.author.bot) return;

    const isDM = !msg.guild;
    const isMentioned = msg.mentions.has(client!.user!);

    // Only respond to DMs or when mentioned in a server
    if (!isDM && !isMentioned) return;

    // Strip the bot mention from the message
    let userMessage = msg.content;
    if (isMentioned && client?.user) {
      userMessage = userMessage.replace(new RegExp(`<@!?${client.user.id}>`, 'g'), '').trim();
    }

    // Ignore empty messages (just a mention with no content)
    if (!userMessage) {
      await msg.reply(
        `👋 Hi ${msg.author.displayName}! I'm ${config.agent.name}. Ask me anything about ${config.agent.company}!`,
      );
      return;
    }

    // ── Handle Commands ─────────────────────────────
    const lowerMessage = userMessage.toLowerCase().trim();

    if (lowerMessage === '!help' || lowerMessage === 'help') {
      const helpEmbed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(`${config.agent.name} — AI Support`)
        .setDescription(
          `I'm your AI support assistant for **${config.agent.company}**.\n` +
            `Just send me a message or mention me in a channel!`,
        )
        .addFields(
          { name: '💬 Chat', value: 'Just type your question!', inline: true },
          { name: '🙋 Human Agent', value: 'Type `!human`', inline: true },
          { name: '🔄 Reset', value: 'Type `!reset`', inline: true },
          { name: '📊 Status', value: 'Type `!status`', inline: true },
        )
        .setFooter({ text: `Powered by ${config.agent.name}` })
        .setTimestamp();

      await msg.reply({ embeds: [helpEmbed] });
      return;
    }

    if (lowerMessage === '!human') {
      const session = memory.getOrCreate('discord', msg.author.id);
      memory.escalate(session, 'User requested human agent via !human command');
      await msg.reply(
        `🙋 I've escalated your conversation to a human agent. They'll be with you shortly.\n` +
          `Type \`back to ai\` to return to AI support.`,
      );
      return;
    }

    if (lowerMessage === '!reset') {
      const session = memory.getOrCreate('discord', msg.author.id);
      memory.clearHistory(session);
      memory.deescalate(session);
      await msg.reply(`🔄 Conversation reset! How can I help you?`);
      return;
    }

    if (lowerMessage === '!status') {
      const statusEmbed = new EmbedBuilder()
        .setColor(0x57f287)
        .setTitle('✅ Bot Status')
        .addFields(
          { name: 'Agent', value: config.agent.name, inline: true },
          { name: 'Status', value: '🟢 Online', inline: true },
          {
            name: 'Channels',
            value:
              `Web: ${config.web.enabled ? '✅' : '❌'} | ` +
              `Telegram: ${config.telegram.enabled ? '✅' : '❌'} | ` +
              `Discord: ${config.discord.enabled ? '✅' : '❌'}`,
          },
        )
        .setTimestamp();

      await msg.reply({ embeds: [statusEmbed] });
      return;
    }

    // ── Process with Agent Brain ────────────────────
    try {
      // Show typing indicator
      if ('sendTyping' in msg.channel) {
        await msg.channel.sendTyping();
      }

      const response = await processMessage(
        'discord',
        msg.author.id,
        userMessage,
        msg.author.displayName,
      );

      // Discord has a 2000 char limit
      const maxLen = 1900;
      if (response.reply.length <= maxLen) {
        await msg.reply(response.reply);
      } else {
        // Split into chunks
        const chunks = response.reply.match(new RegExp(`.{1,${maxLen}}`, 'gs')) || [];
        for (let i = 0; i < chunks.length; i++) {
          const chunkStr = chunks[i];
          if (!chunkStr) continue;
          
          if (i === 0) {
            await msg.reply(chunkStr);
          } else if ('send' in msg.channel) {
            await msg.channel.send(chunkStr);
          }
        }
      }

      // Show escalation notice if applicable
      if (response.shouldEscalate && !response.reply.includes('escalated')) {
        if ('send' in msg.channel) {
          await msg.channel.send(
            `⚠️ This conversation has been flagged for human review.`,
          );
        }
      }
    } catch (err) {
      logger.error('Discord message handling error', { error: err });
      await msg.reply(`😔 Sorry, I encountered an error. Please try again.`);
    }
  });

  // ── Error Handler ───────────────────────────────────
  client.on(Events.Error, (error) => {
    logger.error('Discord.js error', { error: error.message });
  });

  return client;
}

/** Start the Discord bot */
export async function startDiscordBot() {
  const discordBot = createDiscordBot();
  await discordBot.login(config.discord.botToken);
}
