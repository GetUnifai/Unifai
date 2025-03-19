// agent/src/multi-agent/index.ts

/**
 * Multi-Agent Think Tank System
 * Integrates with ElizaOS to provide a collaborative AI discussion experience
 */

import { elizaLogger } from '@elizaos/core';

// Simplified initialization logging without circular references
console.log('[MULTI-AGENT] Initializing module...');

// At the top of each file, after imports:
const FILE_PATH = 'multi-agent/index.ts'; // Adjust for each file
console.log(`[IMPORT] Loading ${FILE_PATH}`);

// Export types
export * from './types';
export * from './eliza-types';

// Export core components explicitly
export { AgentSelector } from './agentSelector';
export { ResponseFormatter } from './responseFormatter';
export { ChatWorkflowManager } from './chatWorkflowManager';  // Explicit named export

// Export endpoint setup
export { setupMultiAgentChatEndpoint } from './chat-endpoint';

// Enhanced logging for module initialization
// Line ~15, enhance the existing logging
console.log('[MULTI-AGENT MODULE] Initializing multi-agent module');
console.log('[MULTI-AGENT MODULE] Exported components:', [
  'AgentSelector', 
  'ResponseFormatter', 
  'ChatWorkflowManager', 
  'setupMultiAgentChatEndpoint'
].join(', '));

try {
  elizaLogger.info('Multi-Agent Module: Components loaded successfully');
  // Add more detail:
  elizaLogger.info('Multi-Agent Module components', {
    exportedComponents: [
      'AgentSelector', 
      'ResponseFormatter', 
      'ChatWorkflowManager', 
      'setupMultiAgentChatEndpoint'
    ],
    version: '1.0.0' // Replace with actual version
  });
} catch (error) {
  console.error('[MULTI-AGENT MODULE] Error during initialization:', error);
}
