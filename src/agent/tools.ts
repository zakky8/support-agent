// ─────────────────────────────────────────────────────────
// Agent Tools
// These are the "hands" of the agent — actions it can
// take beyond just generating text responses.
// ─────────────────────────────────────────────────────────

import { AgentTool, Session } from './types';
import { knowledgeBase } from '../knowledge/store';
import { logger } from '../utils/logger';
import { config } from '../config';

/**
 * Tool: Search Knowledge Base
 * Performs a semantic search against the loaded knowledge documents.
 */
const searchKnowledgeTool: AgentTool = {
  name: 'search_knowledge',
  description:
    'Search the internal knowledge base for relevant information about the company, products, policies, or frequently asked questions. Use this when the user asks something specific that might be documented.',
  execute: async (params) => {
    const query = (params.query as string) || '';
    if (!query) return 'No search query provided.';

    try {
      const results = await knowledgeBase.search(query, config.rag.topK);
      if (results.length === 0) {
        return 'No relevant information found in the knowledge base.';
      }

      return results
        .map(
          (r, i) =>
            `[Source ${i + 1}: ${r.source}]\n${r.content}`,
        )
        .join('\n\n---\n\n');
    } catch (err) {
      logger.error('Knowledge search failed', { error: err });
      return 'Knowledge base search encountered an error.';
    }
  },
};

/**
 * Tool: Escalate to Human Agent
 * Flags the conversation for human takeover.
 */
const escalateToHumanTool: AgentTool = {
  name: 'escalate_to_human',
  description:
    'Escalate the current conversation to a human support agent. Use this when: (1) the user explicitly requests a human, (2) the issue is too complex or sensitive, (3) you cannot resolve the problem after multiple attempts, or (4) the issue involves billing, refunds, or account security.',
  execute: async (params, session) => {
    const reason = (params.reason as string) || 'User requested human agent';
    session.isEscalated = true;
    session.context['escalationReason'] = reason;
    logger.warn('Conversation escalated', {
      sessionId: session.id,
      reason,
    });
    return `Conversation has been escalated to a human agent. Reason: ${reason}`;
  },
};

/**
 * Tool: Get Session Info
 * Returns metadata about the current conversation.
 */
const getSessionInfoTool: AgentTool = {
  name: 'get_session_info',
  description:
    'Get information about the current support session, including the channel, user name, and conversation length. Use this to personalize your responses.',
  execute: async (_params, session) => {
    return JSON.stringify({
      channel: session.channel,
      userName: session.userName || 'Unknown',
      messageCount: session.messages.length,
      sessionAge: `${Math.round((Date.now() - session.createdAt.getTime()) / 60000)} minutes`,
      isEscalated: session.isEscalated,
    });
  },
};

/**
 * Tool: Set Context
 * Stores structured data in the session context for later use.
 */
const setContextTool: AgentTool = {
  name: 'set_context',
  description:
    'Store a piece of information in the conversation context (e.g., the user\'s order number, account ID, or issue category). This helps maintain state across the conversation.',
  execute: async (params, session) => {
    const key = params.key as string;
    const value = params.value;
    if (!key) return 'No context key provided.';
    session.context[key] = value;
    return `Context updated: ${key} = ${JSON.stringify(value)}`;
  },
};

/** All available tools for the agent */
export const agentTools: AgentTool[] = [
  searchKnowledgeTool,
  escalateToHumanTool,
  getSessionInfoTool,
  setContextTool,
];

/** Quick lookup map */
export const toolMap = new Map(agentTools.map((t) => [t.name, t]));
