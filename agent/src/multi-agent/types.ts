// agent/src/multi-agent/types.ts

import type { Character, Runtime, ModelProvider, Content } from './eliza-types';

/**
 * Interface for agent responses in the multi-agent system
 */
export interface AgentResponse {
  agent: string;
  message: string;
}

/**
 * Context for the conversation
 */
export interface ConversationContext {
  turn?: number;
  lastAgent?: string;
  userMessage?: string;
  lastUserMessage?: string;
  messageHistory?: Array<{
    role: string;
    content: string;
  }>;
  recommendedNextAgent?: string | null;
  directlyAddressed?: boolean; // Add this new flag
  [key: string]: any;
}

/**
 * Response type from the ChatWorkflowManager
 */
export interface ChatResponse {
  conversation: AgentResponse[];
  error?: string;
  details?: string;
}

// Re-export the ElizaOS types
export type { Character, Runtime, ModelProvider, Content };
