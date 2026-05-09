// ─────────────────────────────────────────────────────────
// Agent Type Definitions
// ─────────────────────────────────────────────────────────

/** Supported communication channels */
export type ChannelType = 'website' | 'telegram' | 'discord';

/** A single message in a conversation */
export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

/** A conversation session with memory */
export interface Session {
  id: string;
  channel: ChannelType;
  userId: string;
  userName?: string;
  messages: Message[];
  context: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  isEscalated: boolean;
}

/** Result from the RAG knowledge retrieval */
export interface KnowledgeChunk {
  content: string;
  source: string;
  score: number;
}

/** The agent's response after reasoning */
export interface AgentResponse {
  reply: string;
  confidence: number;
  sources: string[];
  shouldEscalate: boolean;
  escalationReason?: string;
  toolsUsed?: string[];
}

/** Agent tool definition */
export interface AgentTool {
  name: string;
  description: string;
  execute: (params: Record<string, unknown>, session: Session) => Promise<string>;
}
