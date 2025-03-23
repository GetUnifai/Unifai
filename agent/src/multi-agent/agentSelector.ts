// agent/src/multi-agent/agentSelector.ts

import { ConversationContext } from './types.ts';
import { elizaLogger } from '@elizaos/core';

/**
 * Agent Selector
 * Determines which agents should respond and in what order
 * Supports dynamic conversation flow and varied agent participation
 */
export class AgentSelector {
  /**
   * Selects which agents should respond and in what order
   * @param message - The user's message
   * @param availableAgents - List of available agent names
   * @param context - Conversation context
   * @returns Ordered array of agent names to process
   */
  public static selectAgents(
    message: string, 
    availableAgents: string[], 
    context: ConversationContext = {}
  ): string[] {
    if (!message || !availableAgents || availableAgents.length === 0) {
      return availableAgents;
    }
    
    console.log(`[AGENT SELECTOR] Selecting for: "${message.substring(0, 30)}..."`);
    
    const messageLower = message.toLowerCase();

    // Add blockchain query detection
    const solanaAddressRegex = /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g;
    const hasAddress = solanaAddressRegex.test(messageLower);
    const blockchainKeywords = ['wallet', 'token', 'solana', 'blockchain', 'crypto'];
    const hasBlockchainKeywords = blockchainKeywords.some(kw => messageLower.includes(kw));

    // If this is a blockchain query, prioritize Alex
    if (hasAddress || hasBlockchainKeywords) {
      console.log('[AGENT_SELECTOR] Blockchain query detected:', {
        hasAddress,
        hasBlockchainKeywords,
        matchingKeywords: blockchainKeywords.filter(kw => messageLower.includes(kw))
      });
      
      // Force Alex to be first responder for blockchain queries if available
      const alexIndex = availableAgents.indexOf('Analyst Alex');
      if (alexIndex >= 0) {
        console.log('[AGENT_SELECTOR] Prioritizing Analyst Alex for blockchain query');
        
        // Create a new array with Alex first, then the rest
        const reordered = ['Analyst Alex'];
        availableAgents.forEach(agent => {
          if (agent !== 'Analyst Alex') reordered.push(agent);
        });
        
        return reordered;
      }
    }
    
    // 1. Check for explicit agent mentions first (direct addressing)
    const mentionedAgents = this.getExplicitlyMentionedAgents(messageLower, availableAgents);
    if (mentionedAgents.length > 0) {
      elizaLogger.info(`Directly addressed agents: ${mentionedAgents.join(', ')}`);
      return mentionedAgents;
    }
    
    // 2. Determine how many agents should respond based on context
    const responseCount = this.determineResponseCount(context, messageLower);
    
    // 3. Identify the most relevant agents for this message
    const rankedAgents = this.rankAgentsByRelevance(messageLower, availableAgents, context);
    
    // Use the most relevant agents up to the determined count
    let selectedAgents = rankedAgents.slice(0, responseCount);
    
    // Apply relationship-based ordering with context awareness
    if (context.turn > 1) {
      selectedAgents = this.applyRelationshipBasedOrdering(selectedAgents, context);
    }
    
    elizaLogger.debug(`Selected ${selectedAgents.length} agents: ${selectedAgents.join(', ')}`);
    
    return selectedAgents;
  }

  /**
   * Identifies agents directly addressed in the message
   * @param messageLower - Lowercase message text
   * @param availableAgents - Available agent names
   * @returns Array of directly addressed agent names
   */
  private static getExplicitlyMentionedAgents(
    messageLower: string, 
    availableAgents: string[]
  ): string[] {
    const mentionedAgents: string[] = [];
    
    for (const agent of availableAgents) {
      const agentLower = agent.toLowerCase();
      const firstName = agent.split(' ')[1]?.toLowerCase();
      
      if (!firstName) continue;
      
      // Direct addressing at the beginning of the message
      if (messageLower.startsWith(`${firstName},`) || 
          messageLower.startsWith(`${firstName}:`) ||
          messageLower.startsWith(`${agentLower},`) || 
          messageLower.startsWith(`${agentLower}:`)) {
        mentionedAgents.push(agent);
        continue;
      }
      
      // Enhanced detection of direct addressing patterns
      // Look for more natural addressing forms throughout the message
      const directPatterns = [
        new RegExp(`\\b${firstName},\\s`, 'i'),  // "Alex, what do you think"
        new RegExp(`\\b${firstName}:\\s`, 'i'),  // "Alex: tell me about"
        new RegExp(`\\bask\\s+${firstName}\\b`, 'i'), // "can you ask Alex"
        new RegExp(`\\b${firstName}\\s+please\\b`, 'i'), // "Alex please"
        new RegExp(`\\bhey\\s+${firstName}\\b`, 'i'), // "Hey Alex"
        new RegExp(`\\bwhat\\s+(?:do|does|would)\\s+${firstName}\\s+think`, 'i') // "what does Alex think"
      ];
      
      for (const pattern of directPatterns) {
        if (pattern.test(messageLower)) {
          mentionedAgents.push(agent);
          break;
        }
      }
      
      // Check for name mentions with a question
      if (!mentionedAgents.includes(agent) && 
          (messageLower.includes(`${firstName}`) || messageLower.includes(`${agentLower}`)) && 
          messageLower.includes('?')) {
        mentionedAgents.push(agent);
      }
    }
    
    return mentionedAgents;
  }
  
  /**
   * Determines how many agents should respond to create natural conversation flow
   * @param context - Conversation context
   * @param message - The message text (lowercase)
   * @returns Number of agents that should respond
   */
  private static determineResponseCount(context: ConversationContext, message: string): number {
    const turn = context.turn || 1;
    
    // First few turns should have more agents respond to establish character
    if (turn <= 2) {
      return 3; // All three agents respond at the beginning
    }
    
    // Check for terms that suggest the user wants comprehensive responses
    const comprehensiveTerms = ['everyone', 'all', 'each', 'debate', 'discuss', 'perspectives'];
    if (comprehensiveTerms.some(term => message.includes(term))) {
      console.log(`[AGENT SELECTOR] User requested comprehensive responses: all agents will respond`);
      return 3; // All agents respond when explicitly requested
    }
    
    // Check for terms suggesting focused/brief responses
    const focusedTerms = ['briefly', 'quick', 'short', 'simple', 'just one'];
    if (focusedTerms.some(term => message.includes(term))) {
      console.log(`[AGENT SELECTOR] User requested focused response: single agent`);
      return 1; // Just one agent for brief/focused requests
    }
    
    // More dynamic probability-based selection for later turns
    // Higher chance of varied response counts as conversation progresses
    
    // Chance of single agent responses increases with turn count
    const singleAgentChance = Math.min(0.4, 0.15 + (turn * 0.05));
    if (Math.random() < singleAgentChance) {
      console.log(`[AGENT SELECTOR] Selecting single agent response (turn ${turn})`);
      return 1;
    }
    
    // Chance of two-agent responses also increases but plateaus
    const twoAgentChance = Math.min(0.5, 0.2 + (turn * 0.03));
    if (Math.random() < twoAgentChance) {
      console.log(`[AGENT SELECTOR] Selecting two agent response (turn ${turn})`);
      return 2;
    }
    
    // Default to all three agents (decreasing probability as turns increase)
    return 3;
  }
  
  /**
   * Ranks agents by relevance to the current message and conversation context
   * @param messageLower - Lowercase message text
   * @param availableAgents - Available agent names
   * @param context - Conversation context
   * @returns Ordered array of agent names by relevance
   */
  private static rankAgentsByRelevance(
    messageLower: string,
    availableAgents: string[],
    context: ConversationContext
  ): string[] {
    // Define topic/expertise keywords for each agent - expanded for better matching
    const agentKeywords = {
      'Analyst Alex': [
        // Data and research terms
        'data', 'analysis', 'statistics', 'numbers', 'research', 'evidence', 'metrics',
        'probability', 'risks', 'facts', 'study', 'report', 'measure', 'quantify',
        // Financial terms
        'costs', 'investment', 'budget', 'finance', 'economic', 'economy', 'market',
        'price', 'profit', 'revenue', 'growth', 'forecast', 'projection', 'trend',
        // Technical terms
        'technical', 'calculation', 'algorithm', 'model', 'estimate', 'precision',
        'accurate', 'analytical', 'breakdown', 'comparison', 'correlation', 'statistics'
      ],
      'Curious Clara': [
        // Creative and innovation terms
        'creative', 'innovation', 'imagine', 'possibility', 'idea', 'what if',
        'future', 'design', 'different', 'curious', 'dream', 'alternative',
        'wonder', 'create', 'invent', 'inspire', 'transform', 'reimagine',
        // Exploration terms
        'experiment', 'explore', 'discover', 'question', 'challenge', 'possibility',
        'potential', 'unprecedented', 'unconventional', 'unusual', 'outside the box',
        // Speculative terms
        'could', 'might', 'may', 'perhaps', 'possibly', 'imagine', 'consider',
        'theoretically', 'hypothetically', 'creatively', 'wildly', 'brainstorm'
      ],
      'Strategic Sam': [
        // Strategy terms
        'plan', 'strategy', 'implementation', 'decision', 'approach', 'goal',
        'objective', 'next steps', 'roadmap', 'action', 'practical', 'solution',
        // Execution terms
        'execute', 'prioritize', 'timeline', 'milestone', 'coordinate', 'organize',
        'manage', 'lead', 'direct', 'guide', 'align', 'streamline', 'implement',
        // Pragmatic terms
        'realistic', 'effective', 'efficient', 'practical', 'achievable', 'tangible',
        'concrete', 'step-by-step', 'systematic', 'structured', 'method', 'process',
        'framework', 'best practice', 'recommendation', 'priority', 'tradeoff'
      ]
    };

    // Consider conversation context and improve agent scoring
    const lastAgent = context.lastAgent;
    
    // Score each agent based on keyword relevance with improved weighting
    const agentScores = availableAgents.map(agent => {
      const keywords = agentKeywords[agent] || [];
      
      // Base score from keyword matching with improved weighting
      // Words at the beginning of the message count more
      let score = 0;
      
      // Check for keywords and their position in the message
      for (const keyword of keywords) {
        const keywordIndex = messageLower.indexOf(keyword);
        if (keywordIndex >= 0) {
          // Keywords near the start of the message get higher weight
          const positionWeight = Math.max(0.5, 1 - (keywordIndex / Math.min(100, messageLower.length)));
          score += positionWeight;
        }
      }
      
      // Contextual adjustments
      // Preference for agents that haven't spoken recently
      if (agent === lastAgent) {
        score -= 2.5; // Stronger penalty to reduce same agent responding twice in a row
      }
      
      // Boost agents that haven't spoken in several turns
      const recentSpeakers = context.messageHistory?.slice(-6)
        .filter(msg => msg.role === 'assistant' && msg.name === agent)
        .length || 0;
      
      if (recentSpeakers === 0) {
        score += 1.5; // Boost for agents who haven't spoken recently
      }
      
      // Add a small random factor for variety (reduced from 0.5 to 0.3)
      score += Math.random() * 0.3;
      
      return { agent, score };
    });
    
    // Sort by score, highest first
    agentScores.sort((a, b) => b.score - a.score);
    
    console.log(`[AGENT SELECTOR] Agent scores: ${JSON.stringify(agentScores.map(a => ({ 
      agent: a.agent.split(' ')[1], 
      score: a.score.toFixed(2) 
    })))}`);
    
    // Return ordered list of agents
    return agentScores.map(item => item.agent);
  }
  
  /**
   * Applies relationship-based ordering to agent sequence
   * Uses relationships from character files with contextual awareness
   * @param baseOrder - The initial agent order
   * @param context - Conversation context
   * @returns Potentially reordered agent sequence
   */
  private static applyRelationshipBasedOrdering(
    baseOrder: string[],
    context: ConversationContext
  ): string[] {
    if (!context.lastAgent || baseOrder.length < 2 || context.turn < 2) {
      return baseOrder; // Not enough context for relationship ordering
    }
    
    // Apply relationship ordering with increased probability (60% chance, up from 40%)
    // This allows for more natural conversational flow between agents
    if (Math.random() > 0.6) {
      return baseOrder;
    }
    
    // Improved relationship patterns with stronger natural dependencies
    // These patterns create more natural follow-ups in conversation
    const relationshipPatterns = {
      'Analyst Alex': {
        'Curious Clara': 0.75,  // Clara frequently challenges Alex's data with creative angles
        'Strategic Sam': 0.5    // Sam often builds practical steps from Alex's analysis
      },
      'Curious Clara': {
        'Strategic Sam': 0.8,   // Sam naturally grounds Clara's wild ideas (highest probability)
        'Analyst Alex': 0.4     // Alex occasionally fact-checks Clara's speculations
      },
      'Strategic Sam': {
        'Analyst Alex': 0.6,    // Alex often provides data to validate Sam's strategies
        'Curious Clara': 0.5    // Clara sometimes questions Sam's practical limitations
      }
    };
    
    const lastAgent = context.lastAgent;
    const patterns = relationshipPatterns[lastAgent];
    
    if (!patterns) return baseOrder;
    
    // Find who should follow based on patterns and contextual randomness
    const potentialFollowers = Object.keys(patterns);
    
    // Check if we have a strong relational match that's in our sequence
    for (const follower of potentialFollowers) {
      if (baseOrder.includes(follower) && 
          Math.random() < patterns[follower] &&
          follower !== lastAgent) {
        
        // Move this agent to the front of the sequence
        const newOrder = [follower];
        for (const agent of baseOrder) {
          if (agent !== follower) {
            newOrder.push(agent);
          }
        }
        
        console.log(`[AGENT SELECTOR] Applied relationship ordering: ${lastAgent} → ${follower}`);
        return newOrder;
      }
    }
    
    return baseOrder;
  }
  
  /**
   * Identifies which agent might be the best next speaker
   * based on current response content
   * @param responseText - The current agent's response
   * @param currentAgent - The current agent's name
   * @param availableAgents - List of available agents
   * @returns Next recommended agent name or null
   */
  public static identifyRecommendedNextAgent(
    responseText: string,
    currentAgent: string,
    availableAgents: string[]
  ): string | null {
    // Expanded patterns to detect direct addressing and questions
    const otherAgents = availableAgents.filter(a => a !== currentAgent);
    
    for (const agent of otherAgents) {
      const firstName = agent.split(' ')[1];
      if (!firstName) continue;
      
      // Expanded patterns for detecting direct questions or handoffs
      const directPatterns = [
        // Direct questions
        new RegExp(`${firstName},\\s*what do you think`, 'i'),
        new RegExp(`${firstName},\\s*(?:your|any) thoughts`, 'i'),
        new RegExp(`What do you think,\\s*${firstName}`, 'i'),
        new RegExp(`${firstName}\\?`, 'i'),
        // Handoffs and invitations
        new RegExp(`(?:over to|back to) you,?\\s*${firstName}`, 'i'),
        new RegExp(`${firstName},\\s*(?:would you like to|care to) (?:add|comment|share)`, 'i'),
        new RegExp(`I'd like to hear from\\s*${firstName}`, 'i'),
        new RegExp(`${firstName} might (?:have|know|add)`, 'i')
      ];
      
      for (const pattern of directPatterns) {
        if (pattern.test(responseText)) {
          console.log(`[AGENT SELECTOR] Detected handoff to ${firstName} in response`);
          return agent;
        }
      }
    }
    
    return null;
  }
}
