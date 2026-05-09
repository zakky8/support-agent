// ─────────────────────────────────────────────────────────
// Support Agent — Main Entry Point
// Starts all enabled channels simultaneously.
// ─────────────────────────────────────────────────────────

import { config } from './config';
import { knowledgeBase } from './knowledge/store';
import { logger } from './utils/logger';
import { startWebServer } from './channels/website/server';
import { startTelegramBot } from './channels/telegram/bot';
import { startDiscordBot } from './channels/discord/bot';

async function main() {
  logger.info('═══════════════════════════════════════════════');
  logger.info(`  ${config.agent.name} — AI Support Agent`);
  logger.info(`  Company: ${config.agent.company}`);
  logger.info(`  LLM Provider: ${config.llm.provider}`);
  logger.info('═══════════════════════════════════════════════');

  // 1. Load the knowledge base
  logger.info('Loading knowledge base...');
  await knowledgeBase.loadDocuments();
  logger.info(`Knowledge base ready: ${knowledgeBase.chunkCount} chunks indexed`);

  // 2. Start enabled channels
  const startupPromises: Promise<void>[] = [];

  if (config.web.enabled) {
    startupPromises.push(
      (async () => {
        startWebServer();
      })(),
    );
  } else {
    logger.info('🌐 Website channel: DISABLED');
  }

  if (config.telegram.enabled) {
    startupPromises.push(
      startTelegramBot().catch((err) => {
        logger.error('Failed to start Telegram bot', { error: err });
      }),
    );
  } else {
    logger.info('📱 Telegram channel: DISABLED');
  }

  if (config.discord.enabled) {
    startupPromises.push(
      startDiscordBot().catch((err) => {
        logger.error('Failed to start Discord bot', { error: err });
      }),
    );
  } else {
    logger.info('🎮 Discord channel: DISABLED');
  }

  await Promise.all(startupPromises);
  logger.info('All channels initialized. Agent is ready! 🚀');
}

// ── Graceful Shutdown ─────────────────────────────────
process.on('SIGINT', () => {
  logger.info('Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Shutting down gracefully...');
  process.exit(0);
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', { error: reason });
});

// ── Launch ────────────────────────────────────────────
main().catch((err) => {
  logger.error('Fatal startup error', { error: err });
  process.exit(1);
});
