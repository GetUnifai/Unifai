// agent/src/multi-agent/eliza-types.ts

/**
 * This file integrates with ElizaOS types
 * Import types directly from @elizaos/core
 */
import type {
    Character,
    IAgentRuntime as AgentRuntime,
    ClientInstance,
    Plugin,
    Message
  } from '@elizaos/core';
  
  // Re-export ElizaOS types for use in our multi-agent system
  export type { Character, AgentRuntime, ClientInstance, Plugin, Message };
  
  /**
   * ModelProvider interface based on the implementation in index.ts
   */
  export interface ModelProvider {
    name: string;
    toString: () => string;
    provider: string;
    model: string;
    endpoint?: string;
    languageModel?: (modelName: string) => any;
    generateText: (prompt: string, options?: any) => Promise<string>;
    [key: string]: any;
  }
  
  /**
   * Runtime augmentation to match the structure used in index.ts
   */
  export interface Runtime extends AgentRuntime {
    character: Character;
    modelProvider: ModelProvider;
    agentId: string;
    clients?: ClientInstance[];
    evaluators?: Array<{
      validate: (runtime: Runtime, message: any) => boolean | Promise<boolean>;
      handler: (runtime: Runtime, message: any) => any | Promise<any>;
      [key: string]: any;
    }>;
    databaseAdapter?: any;
    cacheManager?: any;
    initialize?: () => Promise<void>;
    [key: string]: any;
  }
  
  /**
   * Content interface for API responses
   */
  export interface Content {
    text: string;
    action?: string;
    source?: string;
    [key: string]: any;
  }
  
  /**
   * API Response format for multi-agent chat
   */
  export interface ChatResponse {
    conversation: Array<{
      agent: string;
      message: string;
    }>;
    error?: string;
    details?: string;
  }
