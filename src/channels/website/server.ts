// ─────────────────────────────────────────────────────────
// Website Channel — Express + WebSocket Server
// Serves a REST API and WebSocket endpoint for the
// embeddable chat widget.
// ─────────────────────────────────────────────────────────

import express from 'express';
import cors from 'cors';
import expressWs from 'express-ws';
import path from 'path';
import { config } from '../../config';
import { processMessage } from '../../agent/brain';
import { memory } from '../../agent/memory';
import { logger } from '../../utils/logger';
import { v4 as uuid } from 'uuid';

export function createWebServer() {
  const { app } = expressWs(express());

  // ── Middleware ───────────────────────────────────────
  app.use(cors({ origin: config.web.corsOrigin }));
  app.use(express.json());
  app.use(express.static(path.join(__dirname, '../../../public')));

  // ── Health Check ────────────────────────────────────
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'healthy',
      agent: config.agent.name,
      channels: {
        web: config.web.enabled,
        telegram: config.telegram.enabled,
        discord: config.discord.enabled,
      },
    });
  });

  // ── REST Endpoint: Send a message ───────────────────
  app.post('/api/chat', async (req, res) => {
    try {
      const { message, userId, userName } = req.body;

      if (!message || typeof message !== 'string') {
        res.status(400).json({ error: 'message is required and must be a string' });
        return;
      }

      const uid = userId || `web-${uuid()}`;
      const response = await processMessage('website', uid, message, userName);

      res.json({
        reply: response.reply,
        confidence: response.confidence,
        sources: response.sources,
        shouldEscalate: response.shouldEscalate,
      });
    } catch (err) {
      logger.error('Chat endpoint error', { error: err });
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ── WebSocket Endpoint: Real-time chat ──────────────
  app.ws('/ws/chat', (ws, _req) => {
    const userId = `ws-${uuid()}`;
    logger.info(`WebSocket client connected`, { userId });

    ws.on('message', async (raw: string) => {
      try {
        const data = JSON.parse(raw);
        const { message, userName } = data;

        if (!message) {
          ws.send(JSON.stringify({ error: 'message is required' }));
          return;
        }

        // Send typing indicator
        ws.send(JSON.stringify({ type: 'typing', isTyping: true }));

        const response = await processMessage('website', userId, message, userName);

        // Send the response
        ws.send(
          JSON.stringify({
            type: 'message',
            reply: response.reply,
            confidence: response.confidence,
            sources: response.sources,
            shouldEscalate: response.shouldEscalate,
          }),
        );
      } catch (err) {
        logger.error('WebSocket message error', { error: err });
        ws.send(JSON.stringify({ type: 'error', error: 'Failed to process message' }));
      }
    });

    ws.on('close', () => {
      logger.info(`WebSocket client disconnected`, { userId });
    });
  });

  // ── Admin: List active sessions ─────────────────────
  app.get('/api/admin/sessions', (_req, res) => {
    const sessions = memory.getAllSessions().map((s) => ({
      id: s.id,
      channel: s.channel,
      userId: s.userId,
      userName: s.userName,
      messageCount: s.messages.length,
      isEscalated: s.isEscalated,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    }));
    res.json({ sessions, total: sessions.length });
  });

  return app;
}

/** Start the web server (used when running standalone) */
export function startWebServer() {
  const app = createWebServer();
  app.listen(config.web.port, () => {
    logger.info(`🌐 Website channel running on http://localhost:${config.web.port}`);
    logger.info(`   REST API:   POST http://localhost:${config.web.port}/api/chat`);
    logger.info(`   WebSocket:  ws://localhost:${config.web.port}/ws/chat`);
    logger.info(`   Widget:     http://localhost:${config.web.port}/widget/`);
  });
}
