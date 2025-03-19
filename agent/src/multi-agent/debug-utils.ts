import { elizaLogger } from '@elizaos/core';

export const FILE_PATH = 'multi-agent/debug-utils.ts';
console.log(`[IMPORT] Loading ${FILE_PATH}`);

export const logAgentResponse = (agentName: string, responseText: string, isRaw: boolean = false) => {
  const type = isRaw ? 'RAW' : 'FORMATTED';
  console.log(`[AGENT ${type} RESPONSE][${agentName}] ${responseText.substring(0, 100)}${responseText.length > 100 ? '...' : ''}`);
  
  // For detailed debug log files
  elizaLogger.debug(`${agentName} ${type.toLowerCase()} response`, {
    agent: agentName,
    responseLength: responseText.length,
    timestamp: new Date().toISOString(),
    type: type
  });
};

export const logRequestStart = (requestId: string, message: string, sessionId: string) => {
  console.log(`\n====== REQUEST #${requestId} START ======`);
  console.log(`Message: "${message.substring(0, 50)}${message.length > 50 ? '...' : ''}"`);
  console.log(`Session ID: ${sessionId}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
};

export const logRequestEnd = (requestId: string, success: boolean, responseCount: number) => {
  console.log(`====== REQUEST #${requestId} ${success ? 'COMPLETE' : 'FAILED'} ======`);
  if (success) {
    console.log(`Generated ${responseCount} responses`);
  }
  console.log(`Duration: ${new Date().toISOString()}`);
  console.log(`\n`);
};

export const logError = (component: string, error: any, context?: any) => {
  console.error(`[ERROR][${component}] ${error.message}`);
  console.error(`Stack trace: ${error.stack}`);
  if (context) {
    console.error(`Context: ${JSON.stringify(context, null, 2)}`);
  }
  
  elizaLogger.error(`Error in ${component}`, {
    error: error.message,
    stack: error.stack,
    context: context ? JSON.stringify(context) : undefined
  });
};
