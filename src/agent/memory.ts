// ─────────────────────────────────────────────────────────
// Session Memory Manager
// Maintains conversation state per user across channels.
// Uses in-memory store; swap for Redis/PostgreSQL in prod.
// ─────────────────────────────────────────────────────────

import { v4 as uuid } from 'uuid';
import { Session, Message, ChannelType } from './types';
import { logger } from '../utils/logger';

/** Maximum messages to keep in short-term memory per session */
const MAX_HISTORY = 50;

/** Session TTL in milliseconds (2 hours) */
const SESSION_TTL = 2 * 60 * 60 * 1000;

class SessionMemory {
  private sessions: Map<string, Session> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Periodically evict expired sessions
    this.cleanupInterval = setInterval(() => this.evictExpired(), 60_000);
  }

  /**
   * Get or create a session for a given user+channel combination.
   * Sessions are keyed by `{channel}:{userId}` so a user on Telegram
   * and the same user on Discord have separate conversation threads.
   */
  getOrCreate(channel: ChannelType, userId: string, userName?: string): Session {
    const key = `${channel}:${userId}`;
    let session = this.sessions.get(key);

    if (!session) {
      session = {
        id: uuid(),
        channel,
        userId,
        userName,
        messages: [],
        context: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        isEscalated: false,
      };
      this.sessions.set(key, session);
      logger.info(`New session created`, { sessionId: session.id, channel, userId });
    }

    return session;
  }

  /** Add a message to the session and trim if over limit */
  addMessage(session: Session, message: Message): void {
    session.messages.push(message);
    session.updatedAt = new Date();

    // Keep only the most recent messages (sliding window)
    if (session.messages.length > MAX_HISTORY) {
      session.messages = session.messages.slice(-MAX_HISTORY);
    }
  }

  /** Get conversation history formatted for the LLM */
  getHistory(session: Session): Array<{ role: string; content: string }> {
    return session.messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));
  }

  /** Mark a session as escalated to human agent */
  escalate(session: Session, reason: string): void {
    session.isEscalated = true;
    session.context['escalationReason'] = reason;
    session.updatedAt = new Date();
    logger.warn(`Session escalated to human`, {
      sessionId: session.id,
      reason,
    });
  }

  /** Reset escalation (when human agent hands back to AI) */
  deescalate(session: Session): void {
    session.isEscalated = false;
    delete session.context['escalationReason'];
    session.updatedAt = new Date();
  }

  /** Clear a session's conversation history */
  clearHistory(session: Session): void {
    session.messages = [];
    session.updatedAt = new Date();
  }

  /** Get all active sessions (for admin dashboard) */
  getAllSessions(): Session[] {
    return Array.from(this.sessions.values());
  }

  /** Evict sessions that have been idle longer than TTL */
  private evictExpired(): void {
    const now = Date.now();
    for (const [key, session] of this.sessions.entries()) {
      if (now - session.updatedAt.getTime() > SESSION_TTL) {
        this.sessions.delete(key);
        logger.debug(`Session evicted (TTL)`, { sessionId: session.id });
      }
    }
  }

  /** Cleanup on shutdown */
  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.sessions.clear();
  }
}

// Singleton instance
export const memory = new SessionMemory();
