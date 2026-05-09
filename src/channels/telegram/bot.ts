// ─────────────────────────────────────────────────────────
// Telegram Channel — Telegraf Bot Connector
// Forwards all Telegram messages to the central agent brain.
// ─────────────────────────────────────────────────────────

import { Telegraf, Context } from 'telegraf';
import { config } from '../../config';
import { processMessage } from '../../agent/brain';
import { memory } from '../../agent/memory';
import { logger } from '../../utils/logger';

let bot: Telegraf | null = null;

export function createTelegramBot(): Telegraf {
  if (!config.telegram.botToken) {
    throw new Error('TELEGRAM_BOT_TOKEN is not set in environment variables');
  }

  bot = new Telegraf(config.telegram.botToken);

  // ── /start Command ──────────────────────────────────
  bot.start(async (ctx: Context) => {
    const userName = ctx.from?.first_name || 'there';
    await ctx.reply(
      `👋 Hi ${userName}! I'm ${config.agent.name}, your AI support assistant for ${config.agent.company}.\n\n` +
        `Ask me anything and I'll do my best to help!\n\n` +
        `💡 **Quick commands:**\n` +
        `/help — Show available commands\n` +
        `/human — Talk to a human agent\n` +
        `/reset — Start a fresh conversation`,
      { parse_mode: 'Markdown' },
    );
  });

  // ── /help Command ───────────────────────────────────
  bot.help(async (ctx: Context) => {
    await ctx.reply(
      `🤖 **${config.agent.name} — Help**\n\n` +
        `Just send me a message and I'll assist you!\n\n` +
        `**Commands:**\n` +
        `/start — Welcome message\n` +
        `/help — This help menu\n` +
        `/human — Request a human agent\n` +
        `/reset — Clear conversation history\n` +
        `/status — Check bot status`,
      { parse_mode: 'Markdown' },
    );
  });

  // ── /human Command ──────────────────────────────────
  bot.command('human', async (ctx: Context) => {
    const userId = ctx.from?.id.toString() || '';
    const session = memory.getOrCreate('telegram', userId);
    memory.escalate(session, 'User requested human agent via /human command');

    await ctx.reply(
      `🙋 I've escalated your conversation to a human agent. They'll be with you as soon as possible.\n\n` +
        `In the meantime, feel free to add more context about your issue.\n` +
        `Type "back to ai" to return to AI support.`,
    );
  });

  // ── /reset Command ──────────────────────────────────
  bot.command('reset', async (ctx: Context) => {
    const userId = ctx.from?.id.toString() || '';
    const session = memory.getOrCreate('telegram', userId);
    memory.clearHistory(session);
    memory.deescalate(session);

    await ctx.reply(
      `🔄 Conversation reset! I've cleared our chat history.\n` +
        `How can I help you today?`,
    );
  });

  // ── /status Command ─────────────────────────────────
  bot.command('status', async (ctx: Context) => {
    await ctx.reply(
      `✅ **Bot Status**\n` +
        `Agent: ${config.agent.name}\n` +
        `Status: Online\n` +
        `Channels: Web${config.web.enabled ? ' ✅' : ' ❌'} | ` +
        `Telegram${config.telegram.enabled ? ' ✅' : ' ❌'} | ` +
        `Discord${config.discord.enabled ? ' ✅' : ' ❌'}`,
      { parse_mode: 'Markdown' },
    );
  });

  // ── Text Messages ───────────────────────────────────
  bot.on('text', async (ctx) => {
    const userId = ctx.from.id.toString();
    const userName = ctx.from.first_name || undefined;
    const message = ctx.message.text;

    // Show typing indicator
    await ctx.sendChatAction('typing');

    try {
      const response = await processMessage('telegram', userId, message, userName);

      // Send the response (split if too long for Telegram's 4096 char limit)
      const maxLen = 4000;
      if (response.reply.length <= maxLen) {
        await ctx.reply(response.reply, { parse_mode: 'Markdown' }).catch(() => {
          // Fallback without markdown if parsing fails
          return ctx.reply(response.reply);
        });
      } else {
        // Split into chunks
        const chunks = response.reply.match(new RegExp(`.{1,${maxLen}}`, 'gs')) || [];
        for (const chunk of chunks) {
          await ctx.reply(chunk);
        }
      }

      // Notify if escalated
      if (response.shouldEscalate && !response.reply.includes('escalated')) {
        await ctx.reply(
          `⚠️ I've flagged this conversation for a human agent to review. They may join shortly.`,
        );
      }
    } catch (err) {
      logger.error('Telegram message handling error', { error: err, userId });
      await ctx.reply(
        `😔 Sorry, I encountered an error processing your message. Please try again.`,
      );
    }
  });

  // ── Error Handler ───────────────────────────────────
  bot.catch((err: unknown) => {
    logger.error('Telegraf error', { error: err instanceof Error ? err.message : String(err) });
  });

  return bot;
}

/** Start the Telegram bot (used when running standalone) */
export async function startTelegramBot() {
  const telegramBot = createTelegramBot();

  // Use long polling (simpler than webhooks for development)
  await telegramBot.launch();
  logger.info(`📱 Telegram bot started: @${(await telegramBot.telegram.getMe()).username}`);

  // Graceful shutdown
  process.once('SIGINT', () => telegramBot.stop('SIGINT'));
  process.once('SIGTERM', () => telegramBot.stop('SIGTERM'));
}
