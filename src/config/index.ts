import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export const config = {
  // ── LLM ───────────────────────────────────────────
  llm: {
    provider: (process.env.LLM_PROVIDER || 'google') as 'google' | 'openai',
    google: {
      apiKey: process.env.GOOGLE_API_KEY || '',
      model: process.env.GOOGLE_MODEL || 'gemini-2.0-flash',
    },
    openai: {
      apiKey: process.env.OPENAI_API_KEY || '',
      model: process.env.OPENAI_MODEL || 'gpt-4o',
    },
  },

  // ── Agent Persona ─────────────────────────────────
  agent: {
    name: process.env.AGENT_NAME || 'Atlas',
    company: process.env.AGENT_COMPANY || 'YourCompany',
    persona: process.env.AGENT_PERSONA || 'You are a helpful AI support agent.',
  },

  // ── RAG ───────────────────────────────────────────
  rag: {
    knowledgeDir: path.resolve(process.env.KNOWLEDGE_DIR || './knowledge'),
    topK: parseInt(process.env.RAG_TOP_K || '5', 10),
    chunkSize: parseInt(process.env.RAG_CHUNK_SIZE || '1000', 10),
    chunkOverlap: parseInt(process.env.RAG_CHUNK_OVERLAP || '200', 10),
  },

  // ── Website Channel ───────────────────────────────
  web: {
    enabled: process.env.WEB_ENABLED === 'true',
    port: parseInt(process.env.WEB_PORT || '3000', 10),
    corsOrigin: process.env.WEB_CORS_ORIGIN || '*',
  },

  // ── Telegram Channel ──────────────────────────────
  telegram: {
    enabled: process.env.TELEGRAM_ENABLED === 'true',
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
  },

  // ── Discord Channel ───────────────────────────────
  discord: {
    enabled: process.env.DISCORD_ENABLED === 'true',
    botToken: process.env.DISCORD_BOT_TOKEN || '',
    clientId: process.env.DISCORD_CLIENT_ID || '',
  },

  // ── Logging ───────────────────────────────────────
  logLevel: process.env.LOG_LEVEL || 'info',
};
