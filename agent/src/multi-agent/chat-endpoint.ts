// agent/src/multi-agent/chat-endpoint.ts

import { Request, Response } from 'express';
import { ChatWorkflowManager } from './chatWorkflowManager.ts';  // Import from index
import { elizaLogger } from '@elizaos/core';
import { Runtime } from './types.ts';

// At the top of each file, after imports:
const FILE_PATH = 'multi-agent/chat-endpoint.ts'; // Adjust for each file
console.log(`[IMPORT] Loading ${FILE_PATH}`);


/**
 * Multi-Agent Chat Endpoint Configuration
 * Integrates with ElizaOS DirectClient
 */
export function setupMultiAgentChatEndpoint(app: any, runtimes: Record<string, Runtime>): void {
  // Comprehensive runtime logging
  elizaLogger.info('Setting up multi-agent chat endpoint');
  console.log('=== MULTI-AGENT CHAT ENDPOINT INITIALIZATION ===');
  console.log('Available Runtimes:', Object.keys(runtimes));
  
  // Enhanced but simplified runtime validation
  const validRuntimes = Object.entries(runtimes)
    .filter(([name, runtime]) => {
      // Basic validation
      const isValid = !!runtime && !!runtime.modelProvider && !!runtime.character;
      
      if (!isValid) {
        console.error(`Invalid runtime for agent: ${name}`);
        elizaLogger.warn(`Invalid runtime detected for agent: ${name}`);
        return false;
      }
      
      // Log enhanced character properties if present
      const hasEnhancedProps = (
        !!runtime.character.adjectives?.length ||
        !!runtime.character.relationships ||
        !!runtime.character.style?.chat?.length ||
        !!runtime.character.topics?.length
      );
      
      if (hasEnhancedProps) {
        console.log(`Agent ${name} has enhanced character definition`);
        elizaLogger.debug(`Enhanced character properties detected for ${name}`, {
          hasAdjectives: !!runtime.character.adjectives?.length,
          hasRelationships: !!runtime.character.relationships,
          hasChatStyle: !!runtime.character.style?.chat?.length,
          hasTopics: !!runtime.character.topics?.length
        });
      }
      
      return true;
    })
    .reduce((acc, [name, runtime]) => ({ ...acc, [name]: runtime }), {});

  console.log('Validated Runtimes:', Object.keys(validRuntimes));
  
  // Enhanced error handling for runtime validation
  if (Object.keys(validRuntimes).length === 0) {
    const errorMsg = 'No valid agent runtimes found. Multi-agent chat cannot be initialized.';
    console.error(errorMsg);
    elizaLogger.error(errorMsg);
    throw new Error(errorMsg);
  }

  // Create a single instance of the chat workflow manager
  let chatManager: ChatWorkflowManager;
  try {
    chatManager = new ChatWorkflowManager(validRuntimes);
    console.log('Chat Workflow Manager created successfully');
  } catch (managerInitError) {
    console.error('Failed to create ChatWorkflowManager:', managerInitError);
    elizaLogger.error('ChatWorkflowManager initialization failed', managerInitError);
    throw managerInitError;
  }
  
  // Register the multi-agent chat endpoint
  app.post('/multi-agent-chat', async (req: Request, res: Response) => {
    // Comprehensive request logging
    const requestId = Date.now().toString(36) + Math.random().toString(36).substring(2, 5);
    console.log(`\n=== MULTI-AGENT CHAT REQUEST #${requestId} RECEIVED ===`);
    console.log(`Request Body: ${JSON.stringify({
      messagePreview: req.body.message?.substring(0, 50) + (req.body.message?.length > 50 ? '...' : ''),
      sessionId: req.body.sessionId || 'default',
      messageLength: req.body.message?.length || 0
    }, null, 2)}`);
    
    elizaLogger.info(`New multi-agent chat request #${requestId}`, {
      messagePreview: req.body.message?.substring(0, 50) + (req.body.message?.length > 50 ? '...' : ''),
      sessionId: req.body.sessionId || 'default',
      timestamp: new Date().toISOString()
    });
    
    // Set a timeout to handle long-running requests
    const timeout = setTimeout(() => {
      console.log('REQUEST TIMEOUT: Multi-agent chat request exceeded 45 seconds');
      elizaLogger.warn("Request timed out after 45 seconds");
      res.status(504).json({
        error: "Request timed out",
        conversation: [{ agent: "System", message: "The request took too long to process. Please try again later." }]
      });
    }, 45000);
    
    try {
      const { message, sessionId = 'default' } = req.body;
      
      // Validate input
      if (!message) {
        console.log('INVALID REQUEST: No message provided');
        clearTimeout(timeout);
        return res.status(400).json({ 
          error: "Message is required", 
          details: "The request must include a message to process" 
        });
      }
      
      // Log available agents
      console.log('Available Agents:', Object.keys(validRuntimes));
      elizaLogger.debug("Available agents in runtimes", { agents: Object.keys(validRuntimes) });
      
      // Detailed processing start log
      console.log(`Starting message processing for: "${message.substring(0, 50)}${message.length > 50 ? '...' : ''}"`);
      
      // Process the message through the chat workflow manager 
      console.log(`[REQUEST #${requestId}] Starting message processing for: "${message.substring(0, 50)}${message.length > 50 ? '...' : ''}"...`);
      elizaLogger.info(`Processing request #${requestId}`, {
        sessionId: sessionId,
        availableAgents: Object.keys(validRuntimes).join(', ')
      });
      
      // Process the message through the chat workflow manager
      let responses;
      try {
        responses = await chatManager.processMessage(message, sessionId);
        console.log(`[REQUEST #${requestId}] Processing complete. Generated ${responses?.length || 0} responses`);
        elizaLogger.info(`Request #${requestId} processing complete`, {
          responseCount: responses?.length || 0,
          sessionId: sessionId
        });
      } catch (processingError) {
        console.error('MESSAGE PROCESSING ERROR:', processingError);
        elizaLogger.error("Error processing message", { 
          error: processingError,
          message: message,
          sessionId: sessionId
        });
        
        clearTimeout(timeout);
        return res.status(500).json({
          error: "Message processing failed",
          details: processingError instanceof Error ? processingError.message : String(processingError),
          conversation: [{ 
            agent: "System", 
            message: "An error occurred while processing your request. Please try again later." 
          }]
        });
      }
      
      // Check if responses were generated
      if (!responses || responses.length === 0) {
        console.log('NO RESPONSES GENERATED');
        elizaLogger.warn("No responses returned from processMessage");
        
        clearTimeout(timeout);
        return res.json({ 
          conversation: [{ 
            agent: "System", 
            message: "Our agents are taking a break. Please try again." 
          }] 
        });
      }
      
      // Log response details
      console.log(`Generated ${responses.length} responses`);
      console.log('Response Preview:', JSON.stringify(responses.slice(0, 1), null, 2));
      elizaLogger.debug(`Generated ${responses.length} responses for multi-agent chat`);
      
      // Clear timeout and send response
      clearTimeout(timeout);
      res.json({ conversation: responses });
      
    } catch (error) {
      console.error('UNEXPECTED ERROR IN MULTI-AGENT CHAT ENDPOINT:', error);
      elizaLogger.error("Unexpected error in multi-agent chat endpoint", { 
        error: error,
        stack: error instanceof Error ? error.stack : undefined 
      });
      
      clearTimeout(timeout);
      res.status(500).json({
        error: "Unexpected server error",
        details: error instanceof Error ? error.message : String(error),
        conversation: [{ 
          agent: "System", 
          message: "An unexpected error occurred. Our team has been notified." 
        }]
      });
    }
  });
  
  console.log('=== MULTI-AGENT CHAT ENDPOINT SETUP COMPLETE ===');
  elizaLogger.info('Multi-agent chat endpoint successfully configured');
}
