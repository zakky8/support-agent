import { v4 as uuid } from 'uuid';
import { createClient } from 'redis';
import { Session, Message, ChannelType } from './types';
import { logger } from '../utils/logger';

const MAX_HISTORY = 50;
const SESSION_TTL_SECONDS = 2 * 60 * 60; // 2 hours

class RedisSessionMemory {
  private client;
  private isConnected = false;

  constructor() {
    this.client = createClient({
      url: process.env.REDIS_URL || 'redis://127.0.0.1:6379'
    });

    this.client.on('error', (err) => logger.error('Redis Client Error', err));
    this.client.on('connect', () => {
      this.isConnected = true;
      logger.info('Connected to Redis for Session Memory');
    });
  }

  async connect() {
    if (!this.isConnected) {
      await this.client.connect();
    }
  }

  private async getSession(key: string): Promise<Session | null> {
    await this.connect();
    const data = await this.client.get(key);
    if (!data) return null;
    try {
      const session = JSON.parse(data);
      // Revive dates
      session.createdAt = new Date(session.createdAt);
      session.updatedAt = new Date(session.updatedAt);
      session.messages.forEach((m: any) => m.timestamp = new Date(m.timestamp));
      return session as Session;
    } catch (e) {
      return null;
    }
  }

  private async saveSession(key: string, session: Session): Promise<void> {
    await this.connect();
    await this.client.setEx(key, SESSION_TTL_SECONDS, JSON.stringify(session));
  }

  async getOrCreate(channel: ChannelType, userId: string, userName?: string): Promise<Session> {
    const key = `session:${channel}:${userId}`;
    let session = await this.getSession(key);

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
      await this.saveSession(key, session);
      logger.info(`New session created in Redis`, { sessionId: session.id, channel, userId });
    }

    return session;
  }

  async addMessage(session: Session, message: Message): Promise<void> {
    session.messages.push(message);
    session.updatedAt = new Date();

    if (session.messages.length > MAX_HISTORY) {
      session.messages = session.messages.slice(-MAX_HISTORY);
    }
    
    const key = `session:${session.channel}:${session.userId}`;
    await this.saveSession(key, session);
  }

  getHistory(session: Session): Array<{ role: string; content: string }> {
    return session.messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));
  }

  async escalate(session: Session, reason: string): Promise<void> {
    session.isEscalated = true;
    session.context['escalationReason'] = reason;
    session.updatedAt = new Date();
    
    const key = `session:${session.channel}:${session.userId}`;
    await this.saveSession(key, session);
    
    logger.warn(`Session escalated to human`, {
      sessionId: session.id,
      reason,
    });
  }

  async deescalate(session: Session): Promise<void> {
    session.isEscalated = false;
    delete session.context['escalationReason'];
    session.updatedAt = new Date();
    
    const key = `session:${session.channel}:${session.userId}`;
    await this.saveSession(key, session);
  }

  async clearHistory(session: Session): Promise<void> {
    session.messages = [];
    session.updatedAt = new Date();
    
    const key = `session:${session.channel}:${session.userId}`;
    await this.saveSession(key, session);
  }

  async destroy(): Promise<void> {
    if (this.isConnected) {
      await this.client.quit();
    }
  }
}

export const memory = new RedisSessionMemory();
