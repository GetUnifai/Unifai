// agent/src/multi-agent/chatWorkflowManager.ts

import { 
  Runtime, 
  AgentResponse, 
  ConversationContext, 
  ChatResponse, 
  Character
} from './types.ts';
import { AgentSelector } from './agentSelector.ts';
import { ResponseFormatter } from './responseFormatter.ts';
import { elizaLogger } from '@elizaos/core';
import { logAgentResponse, logRequestStart, logRequestEnd, logError } from './debug-utils.ts';

const LOG_TAG = '[CHAT_WORKFLOW]';

/**
 * Chat Workflow Manager
 * Handles the multi-agent think tank conversation flow
 * Integrates with ElizaOS Runtime system
 */
export class ChatWorkflowManager {
  private runtimes: Record<string, Runtime>;
  private defaultAgentSequence: string[];
  private sessionContexts: Record<string, ConversationContext>;
  private sessionTopics: Record<string, { 
    currentTopic: string,
    previousTopics: string[] 
  }> = {};

  /**
   * Creates a new ChatWorkflowManager
   * @param runtimes - The character runtimes
   */
  constructor(runtimes: Record<string, Runtime>) {
    this.runtimes = runtimes;
    this.defaultAgentSequence = ['Analyst Alex', 'Curious Clara', 'Strategic Sam'];
    this.sessionContexts = {};
    elizaLogger.debug('ChatWorkflowManager initialized with runtimes:', Object.keys(runtimes));
    console.log(`${LOG_TAG} Initialized with agents: ${Object.keys(runtimes).join(', ')}`);
  }

  /**
   * Gets or creates a conversation context for a session
   * @param sessionId - The session identifier
   * @returns The conversation context
   */
  private getOrCreateContext(sessionId: string): ConversationContext {
    if (!this.sessionContexts[sessionId]) {
      this.sessionContexts[sessionId] = {
        turn: 0,
        messageHistory: []
      };
    }
    return this.sessionContexts[sessionId];
  }
  
  /**
   * Detect if the current message represents a new topic
   * @param currentMessage - The current user message
   * @param lastMessage - The previous user message
   * @returns Boolean indicating if this is likely a new topic
   */
  private isNewTopic(currentMessage: string, lastMessage: string): boolean {
    if (!lastMessage) return false;
    
    // Check for explicit topic change indicators
    const topicChangeCues = ['new topic', 'different topic', 'change subject'];
    const messageLower = currentMessage.toLowerCase();
    if (topicChangeCues.some(cue => messageLower.includes(cue))) {
      return true;
    }
    
    // Simple token overlap similarity check
    const currentWords = new Set(messageLower.split(/\W+/).filter(w => w.length > 3));
    const lastWords = new Set(lastMessage.toLowerCase().split(/\W+/).filter(w => w.length > 3));
    
    const intersection = new Set([...currentWords].filter(x => lastWords.has(x)));
    const similarity = intersection.size / (currentWords.size || 1);
    
    return similarity < 0.15;
  }
  
  /**
   * Handle topic changes, resetting context when needed
   * @param message - The user's message
   * @param sessionId - The session identifier
   */
  private handleTopicChange(message: string, sessionId: string): void {
    const context = this.getOrCreateContext(sessionId);
    
    if (!this.sessionTopics[sessionId]) {
      this.sessionTopics[sessionId] = { currentTopic: "general", previousTopics: [] };
    }
    
    // Check for topic change
    if (context.lastUserMessage && this.isNewTopic(message, context.lastUserMessage)) {
      // Store previous topic 
      const previousTopic = this.sessionTopics[sessionId].currentTopic;
      this.sessionTopics[sessionId].previousTopics.push(previousTopic);
      this.sessionTopics[sessionId].currentTopic = `topic-${Date.now()}`;
      
      // Create clean break in the conversation
      context.messageHistory.push({
        role: 'system',
        content: '--- Topic change ---'
      });
      
      console.log(`${LOG_TAG} Topic change detected. New topic started.`);
    }
  }

  /**
   * Determines which agents should respond to the current message
   * @param message - The user's message
   * @param context - Conversation context
   * @returns Array of agent names to process
   */
  private determineRespondingAgents(
    message: string, 
    context: ConversationContext
  ): string[] {
    // Get available agents that match our sequence
    const availableAgents = this.defaultAgentSequence.filter(name => 
      Object.keys(this.runtimes).includes(name)
    );

    // If none of our preferred agents are available, use whatever we have (up to 3)
    if (availableAgents.length === 0) {
      return Object.keys(this.runtimes).slice(0, 3);
    }
    
    // Check for direct agent addressing in the message
    const directlyAddressedAgents = this.getDirectlyAddressedAgents(message, availableAgents);
    if (directlyAddressedAgents.length > 0) {
      context.directlyAddressed = true;
      console.log(`${LOG_TAG} Directly addressed: ${directlyAddressedAgents.join(', ')}`);
      
      // If only one agent is directly addressed and no "everyone" mentioned, ONLY that agent responds
      // This is now strictly enforced per the recommendation
      if (directlyAddressedAgents.length === 1 && 
          !message.toLowerCase().includes('everyone') && 
          !message.toLowerCase().includes('all')) {
        console.log(`${LOG_TAG} Only ${directlyAddressedAgents[0]} will respond - directly addressed`);
        return directlyAddressedAgents; // Must be enforced with no exceptions
      }
      
      return directlyAddressedAgents;
    } 
    
    // Use the AgentSelector to dynamically determine agent sequence
    return AgentSelector.selectAgents(message, availableAgents, context);
  }
  
  /**
   * Identifies agents that are directly addressed in the message
   * @param message - The user's message
   * @param availableAgents - List of available agents
   * @returns Array of agent names that were directly addressed
   */
  private getDirectlyAddressedAgents(message: string, availableAgents: string[]): string[] {
    const addressedAgents: string[] = [];
    const messageLower = message.toLowerCase();
    
    // Check for direct addressing patterns
    for (const agent of availableAgents) {
      // Get both full name and first name (e.g., "Analyst Alex" and "Alex")
      const fullName = agent.toLowerCase();
      const firstName = agent.split(' ')[1]?.toLowerCase();
      
      if (!firstName) continue;
      
      // Common addressing patterns (at beginning or with punctuation)
      if (messageLower.startsWith(firstName) || 
          messageLower.includes(`${firstName},`) || 
          messageLower.includes(`${firstName}:`) ||
          messageLower.includes(`${fullName},`) ||
          messageLower.includes(`${fullName}:`)) {
        addressedAgents.push(agent);
      }
    }

    return addressedAgents;
  }

  /**
   * Builds a natural prompt for the agent that encourages organic conversation
   * @param message - The user's message
   * @param agentName - The agent's name
   * @param previousResponses - Previous agent responses
   * @param sessionId - Session identifier
   * @returns The prompt for the agent
   */
  private buildAgentPrompt(
    message: string, 
    agentName: string,
    previousResponses: AgentResponse[] = [],
    sessionId: string = "default"
  ): string {
    console.log(`${LOG_TAG} Building prompt for ${agentName}`);
    
    const runtime = this.runtimes[agentName];
    if (!runtime) {
      throw new Error(`No runtime for ${agentName}`);
    }

    const context = this.getOrCreateContext(sessionId);
    const character = runtime.character;
    
    // 1. Character identity section (brief and focused)
    let prompt = `You are ${character.name}.\n`;
    prompt += character.system ? `${character.system}\n\n` : "\n";
    
    // 2. Add specific character directives to force direct answers first
    if (agentName === "Analyst Alex") {
      prompt += "IMPORTANT: Start by directly answering the question with data or facts in 1-2 sentences. Then briefly add context.\n";
      prompt += "Your style is typically data-focused and precise, with a touch of dry humor or skepticism:\n";
      prompt += "- You generally prefer facts and evidence over speculation\n";
      prompt += "- You use examples, statistics, or data points when possible\n";
      prompt += "- You can be skeptical and slightly sarcastic at times\n";
      prompt += "- You challenge unfounded claims and assumptions\n";
      prompt += "- Your responses should be concise and to the point\n\n";
    } else if (agentName === "Curious Clara") {
      prompt += "IMPORTANT: First answer the specific question asked, then explore creative possibilities.\n";
      prompt += "Your style is creative, inquisitive, and energetic:\n";
      prompt += "- You enjoy exploring unconventional ideas and possibilities\n";
      prompt += "- You naturally challenge assumptions and traditional thinking\n";
      prompt += "- You bring energy and enthusiasm to your responses\n";
      prompt += "- You see connections others might miss\n";
      prompt += "- Your thinking is flexible but remains focused on the actual question\n\n";
    } else if (agentName === "Strategic Sam") {
      prompt += "IMPORTANT: Begin with a clear, direct answer to the question, then provide practical next steps.\n";
      prompt += "Your style is practical, solution-oriented, and decisive:\n";
      prompt += "- You focus on actionable insights and implementation\n";
      prompt += "- You synthesize others' ideas into coherent approaches\n";
      prompt += "- You're direct and decisive in your recommendations\n";
      prompt += "- You consider both short and long-term implications\n";
      prompt += "- You're pragmatic and focused on real-world application\n\n";
    }

    // 3. Simple conversation setup
    prompt += "You're having a casual conversation with:\n";

    if (agentName !== "Analyst Alex") {
      prompt += "- Alex: analytical, data-focused, occasionally sarcastic\n";
    }
    if (agentName !== "Curious Clara") {
      prompt += "- Clara: creative, asks thought-provoking questions, imaginative\n";
    }
    if (agentName !== "Strategic Sam") {
      prompt += "- Sam: practical, solution-oriented, synthesizes ideas\n";
    }

    prompt += "\n";
    
    // 4. IMPORTANT: Add specific format instructions to avoid theatrical responses
    prompt += "IMPORTANT FORMAT INSTRUCTIONS: This is a text-only chat conversation. DO NOT include:\n";
    prompt += "- Stage directions in parentheses like (smiles), (pauses), or (thinks)\n";
    prompt += "- Physical actions, facial expressions, or body language\n";
    prompt += "- References to yourself in the third person\n";
    prompt += "- Made-up questions or comments from other participants\n\n";
    
    prompt += "Simply respond directly in first person as yourself in a natural conversational style.\n\n";
    
    // 5. Conversation guidance (more direct)
    prompt += "Guidelines for your response:\n";
    prompt += "- Answer the specific question directly before adding extra context\n";
    prompt += "- Vary your response length - sometimes brief (1-2 sentences), sometimes more detailed\n";
    prompt += "- You may occasionally disagree with other participants in a respectful way\n";
    prompt += "- Focus on adding new insights rather than repeating what's been said\n\n";
    
    // 6. Add relationship-specific guidance when there are previous responses
    if (previousResponses.length > 0) {
      const lastAgent = previousResponses[previousResponses.length - 1].agent;
      
      if (agentName === "Curious Clara" && lastAgent === "Analyst Alex") {
        prompt += "Challenge Alex's data-focused perspective by suggesting an unconventional angle he may have missed.\n";
      } else if (agentName === "Strategic Sam" && lastAgent === "Curious Clara") {
        prompt += "Ground Clara's creative ideas with practical implementation steps or limitations.\n";
      } else if (agentName === "Analyst Alex" && lastAgent === "Strategic Sam") {
        prompt += "Add statistical context or question assumptions in Sam's strategic approach.\n";
      }
    }
    
    // 7. Conversation context
    if (previousResponses.length > 0) {
      prompt += "The user asked: \"" + message + "\"\n\n";
      prompt += "The conversation so far:\n";
      
      previousResponses.forEach(response => {
        // Use first names for brevity
        const firstName = response.agent.split(' ')[1] || response.agent;
        prompt += `${firstName}: ${response.message}\n\n`;
      });
      
      prompt += `Your turn to respond as ${character.name}:\n`;
    } else {
      // First agent responding to user
      prompt += `Respond to this message: "${message}"\n\n`;
    }
    
    return prompt;
  }

  /**
   * Processes a user message through the multi-agent system
   * @param message - The user's message
   * @param sessionId - Optional session identifier for conversation tracking
   * @returns Array of agent responses
   */
  public async processMessage(
    message: string, 
    sessionId: string = 'default'
  ): Promise<AgentResponse[]> {
    const requestId = Date.now().toString(36) + Math.random().toString(36).substring(2, 5);
    logRequestStart(requestId, message, sessionId);
    
    // Get context and handle topic changes
    const context = this.getOrCreateContext(sessionId);
    // Make context available to the ResponseFormatter for length adjustments
    global.currentContext = context;
    this.handleTopicChange(message, sessionId);
    
    // Update context with the current message
    context.lastUserMessage = context.userMessage;
    context.userMessage = message;
    context.turn = (context.turn || 0) + 1;
    
    // Add message to history
    if (!context.messageHistory) context.messageHistory = [];
    context.messageHistory.push({
      role: 'user',
      content: message
    });
    
    // Determine which agents should respond
    const respondingAgents = this.determineRespondingAgents(message, context);
    console.log(`${LOG_TAG} Agent sequence: ${respondingAgents.join(' → ')}`);

    const responses: AgentResponse[] = [];

    // Process each agent in sequence
    for (const agentName of respondingAgents) {
      try {
        console.log(`${LOG_TAG} Processing ${agentName}...`);
        const runtime = this.runtimes[agentName];

        if (!runtime || !runtime.modelProvider || typeof runtime.modelProvider.generateText !== 'function') {
          console.log(`${LOG_TAG} Skipping ${agentName} - invalid runtime or model provider`);
          continue;
        }

        // Update context with last agent who spoke
        context.lastAgent = responses.length > 0 ? responses[responses.length - 1].agent : null;
        
        // Generate prompt
        const prompt = this.buildAgentPrompt(message, agentName, responses, sessionId);
        
        // Generate response with retry
        let responseText = null;
        let attempts = 0;
        const MAX_ATTEMPTS = 2;

        while (!responseText && attempts < MAX_ATTEMPTS) {
          attempts++;
          try {
            // Get model settings from character if available
            const modelConfig = runtime.character.settings?.modelConfig || {};
            
            console.log(`${LOG_TAG} Generating response for ${agentName} (attempt ${attempts}/${MAX_ATTEMPTS})`);
            responseText = await runtime.modelProvider.generateText(prompt, modelConfig);
            
            if (!responseText || responseText.trim() === '') {
              console.log(`${LOG_TAG} Empty response from ${agentName}`);
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          } catch (error) {
            console.error(`${LOG_TAG} Error generating response:`, error);
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }

        // Use fallback if no response after max attempts
        if (!responseText) {
          console.log(`${LOG_TAG} Using fallback response for ${agentName}`);
          responseText = "I need more time to think about this.";
        }
        
        // Process the response to clean up formatting issues
        responseText = ResponseFormatter.processResponse(responseText, agentName);
        
        // Add to responses
        responses.push({
          agent: runtime.character.name,
          message: responseText
        });
        
        // Add to message history
        context.messageHistory.push({
          role: 'assistant',
          content: responseText,
          name: agentName // Add the agent name
        });
      } catch (error) {
        console.error(`${LOG_TAG} Error processing agent ${agentName}:`, error);
        
        // Add fallback response
        responses.push({
          agent: agentName,
          message: "I'm having trouble processing your request right now."
        });
      }
    }

    // Provide system fallback if no agent responded
    if (responses.length === 0) {
      responses.push({
        agent: "System",
        message: "Our agents were unable to process your request. Please try again."
      });
    }

    logRequestEnd(requestId, true, responses.length);
    return responses;
  }
}
