// agent/src/multi-agent/responseFormatter.ts

import { AgentResponse } from './types.ts';
import { elizaLogger } from '@elizaos/core';

/**
 * Response Formatter
 * Cleans and formats agent responses to create natural conversation flow
 * Removes problematic elements like stage directions and fictional interactions
 */
export class ResponseFormatter {
  /**
   * Processes agent responses to create natural interactions
   * Removes stage directions, third-person self-references, and fictional elements
   * @param responseText - The raw response text from the agent
   * @param agentName - The agent's name
   * @returns The processed response
   */
  public static processResponse(responseText: string, agentName: string): string {
    try {
      console.log(`[FORMATTER] Processing response for ${agentName} (${responseText.length} chars)`);
      elizaLogger.debug(`Starting response formatting for ${agentName}`, {
        responseLength: responseText.length
      });
      
      // Basic cleanup
      let processed = responseText.trim();
      
      // Extract agent's first name for easier regex matching
      const firstName = agentName.split(' ')[1] || '';

      // 1. Remove AI assistant prefixes/disclaimers
      const aiPrefixes = [
        "As an AI assistant",
        "I'll respond as",
        "I'll help you with",
        "I'm responding as",
        "I am an AI",
        "As a language model"
      ];
      
      for (const prefix of aiPrefixes) {
        if (processed.toLowerCase().startsWith(prefix.toLowerCase())) {
          const endOfPrefix = processed.indexOf('\n\n');
          if (endOfPrefix !== -1) {
            processed = processed.substring(endOfPrefix).trim();
          }
        }
      }
      
      // 2. Remove ALL stage directions/actions in parentheses
      processed = processed.replace(/\([^)]+\)/g, '');

      // 3. Remove fictional questions from other agents
      const otherAgentNames = ['Alex', 'Clara', 'Sam', 'Analyst Alex', 'Curious Clara', 'Strategic Sam'];
      for (const name of otherAgentNames) {
        // Matches patterns like "(question from Clara)" or "Clara asks:" or "Clara's question:"
        const questionPatterns = [
          new RegExp(`\\((?:curious )?question from ${name}\\)[^\\n]*`, 'gi'),
          new RegExp(`${name} asks:[^\\n]*`, 'gi'),
          new RegExp(`${name}'s question:[^\\n]*`, 'gi')
        ];
        
        for (const pattern of questionPatterns) {
          processed = processed.replace(pattern, '');
        }
      }

      // 4. Remove third-person self-references
      // This handles cases where agents refer to themselves in third person
      const selfReferencePatterns = [
        new RegExp(`${agentName} (thinks|believes|says|notes|points out|suggests|agrees|adds|would say)`, 'gi'),
        new RegExp(`${firstName} (thinks|believes|says|notes|points out|suggests|agrees|adds|would say)`, 'gi')
      ];
      
      for (const pattern of selfReferencePatterns) {
        processed = processed.replace(pattern, 'I');
      }

      // 5. Remove role prefixes if the model added them
      const rolePrefixes = [
        `${agentName}:`,
        `${firstName}:`,
        "Assistant:",
        "AI:"
      ];
      
      for (const prefix of rolePrefixes) {
        if (processed.startsWith(prefix)) {
          processed = processed.substring(prefix.length).trim();
        }
      }
      
      // 6. Remove physical environment references
      const physicalActions = [
        /\b(?:lean(?:s|ed|ing))(?: \w+)*(?: (?:forward|back|in|on))/gi,
        /\b(?:sit(?:s|ting))(?: \w+)*(?: (?:up|down|back))/gi,
        /\b(?:stand(?:s|ing))(?: \w+)*(?: (?:up|back))/gi,
        /\b(?:nod(?:s|ding))(?: \w+)*/gi,
        /\b(?:smile(?:s|d|ing))(?: \w+)*/gi,
        /\b(?:laugh(?:s|ed|ing))(?: \w+)*/gi,
        /\b(?:smirk(?:s|ed|ing))(?: \w+)*/gi,
        /\b(?:wink(?:s|ed|ing))(?: \w+)*/gi,
        /\b(?:gesture(?:s|d|ing))(?: \w+)*/gi,
        /\bin (?:his|her|their) chair\b/gi
      ];
      
      for (const pattern of physicalActions) {
        processed = processed.replace(pattern, '');
      }
      
      // 7. Fix formatting issues caused by the above removals
      // Fix multiple spaces
      processed = processed.replace(/\s{2,}/g, ' ');
      
      // Fix multiple newlines
      processed = processed.replace(/\n\s*\n\s*\n/g, '\n\n');
      
      // Fix sentences that got joined incorrectly
      processed = processed.replace(/([.!?])\s*([A-Z])/g, '$1 $2');
      
      // Fix any lines that now start with conjunctions due to removals
      processed = processed.replace(/\n\s*(And|But|So|Because|However|Therefore|Thus)\s+/g, '\n');
      
      // Remove leading conjunctions from the beginning of the response
      processed = processed.replace(/^(And|But|So|Because|However|Therefore|Thus)\s+/, '');
      
      // Fix capitalization of first letter in case we removed something at the start
      if (processed.length > 0 && /[a-z]/.test(processed[0])) {
        processed = processed.charAt(0).toUpperCase() + processed.slice(1);
      }
      
      // 8. Ensure the message doesn't reference itself in inconsistent ways
      const nameCorrections = [
        new RegExp(`I, ${firstName},`, 'g'),
        new RegExp(`I, ${agentName},`, 'g'),
        new RegExp(`${firstName} thinks`, 'g')
      ];
      
      for (const pattern of nameCorrections) {
        processed = processed.replace(pattern, 'I');
      }
      
      // Apply dynamic length adjustment with improved context sensitivity
      processed = this.applyDynamicLengthAdjustment(processed, agentName, {
        turn: global.currentContext?.turn,
        directlyAddressed: global.currentContext?.directlyAddressed,
        userMessage: global.currentContext?.userMessage || ''
      });
      
      console.log(`[FORMATTER] Completed formatting for ${agentName} (${processed.length} chars)`);
      elizaLogger.debug(`Response formatting complete for ${agentName}`, {
        originalLength: responseText.length,
        processedLength: processed.length
      });
      
      return processed;
    } catch (error) {
      elizaLogger.error(`Error in processResponse: ${error.message}`);
      return responseText; // Return original on error
    }
  }

  /**
   * Applies dynamic length management to responses based on context
   * @param responseText - The response text to adjust
   * @param agentName - The agent's name
   * @param context - Optional conversation context
   * @returns The length-adjusted response
   */
  private static applyDynamicLengthAdjustment(
    responseText: string, 
    agentName: string,
    context?: any
  ): string {
    // Get base length limits per agent - refined for character distinctiveness
    // These are not rigid caps but starting points for dynamic adjustment
    const baseLimits = {
      'Analyst Alex': 1200,  // More concise for Alex - data-focused
      'Curious Clara': 750, // More exploratory for Clara - creative but not rambling
      'Strategic Sam': 850  // Balanced for Sam - practical but thorough
    };
    
    const userMessage = context?.userMessage || '';
    const messageLower = userMessage.toLowerCase();
    
    // Enhanced context sensitivity - look for indicators in user message
    const wantsBrief = /\b(brief|quick|short|simple|summarize|concise)\b/i.test(messageLower);
    const wantsDetailed = /\b(detailed|comprehensive|thorough|explain|elaborate|in depth)\b/i.test(messageLower);
    const isQuestion = messageLower.includes('?');
    const isComplexTopic = /\b(analysis|complex|difficult|challenging|compare|contrast|debate)\b/i.test(messageLower);
    
    // Dynamic factors
    const turn = context?.turn || 1;
    const isTechnical = /\d%|\d+\.\d+|analysis|data|statistics|evidence|metrics/i.test(responseText);
    const isDirectlyAddressed = context?.directlyAddressed || false;
    
    // Calculate chance of brief response based on context
    let briefResponseChance = 0.35; // Base chance - 35%
    
    // Modify chance based on context
    if (wantsBrief) {
      briefResponseChance += 0.4; // Much higher chance of brief response when requested
    } else if (wantsDetailed) {
      briefResponseChance -= 0.25; // Much lower chance when detailed response requested
    }
    
    if (turn > 3) {
      briefResponseChance += 0.05 * Math.min(3, (turn - 3)); // Increase chance as conversation progresses
    }
    
    if (isQuestion) {
      briefResponseChance -= 0.1; // Questions deserve more complete answers
    }
    
    // Determine if this should be a brief response
    const shouldBeBrief = Math.random() < briefResponseChance;
    
    // Calculate adjusted limit with more nuance
    let charLimit = baseLimits[agentName] || 450; // Default limit
    
    // Adjust based on context factors - more intelligently
    if (shouldBeBrief) {
      // Brief response adjustments vary by agent
      if (agentName === 'Analyst Alex') {
        charLimit = charLimit * 0.5; // Alex can be very concise
      } else if (agentName === 'Curious Clara') {
        charLimit = charLimit * 0.6; // Clara needs a bit more space for creativity
      } else {
        charLimit = charLimit * 0.55; // Sam is balanced
      }
    } else if (wantsDetailed || isComplexTopic) {
      // Detailed response adjustments
      if (agentName === 'Analyst Alex' && isTechnical) {
        charLimit = charLimit * 1.4; // Alex gets more space for technical topics
      } else if (agentName === 'Curious Clara') {
        charLimit = charLimit * 1.3; // Clara gets space for creative exploration
      } else {
        charLimit = charLimit * 1.25; // Sam gets balanced expansion
      }
    } else if (isDirectlyAddressed) {
      charLimit = charLimit * 1.2; // Slightly longer when directly addressed
    } else if (turn <= 2) {
      charLimit = charLimit * 1.1; // Slightly longer for first exchanges to establish character
    }
    
    // Technical content adjustments vary by agent
    if (isTechnical) {
      if (agentName === 'Analyst Alex') {
        charLimit *= 1.15; // Alex gets more space for technical content
      } else if (agentName === 'Strategic Sam') {
        charLimit *= 1.05; // Sam gets a little more for practical details
      }
      // Clara doesn't get extra space for technical content
    }
    
    // Add natural variation (±15%)
    charLimit *= (0.85 + (Math.random() * 0.3));
    
    // Log the adjustment details
    console.log(`[FORMATTER] ${agentName} length adjustment: base=${baseLimits[agentName]}, final=${Math.round(charLimit)}, brief=${shouldBeBrief}`);
    
    // If response exceeds limit, trim it intelligently
    if (responseText.length > charLimit) {
      // Approach 1: Try to find a good sentence break
      const truncated = responseText.substring(0, charLimit);
      const lastSentenceMatch = truncated.match(/.*[.!?]/);
      
      if (lastSentenceMatch && lastSentenceMatch[0].length > charLimit * 0.5) {
        // Found a good sentence break that's not too short
        return lastSentenceMatch[0].trim();
      }
      
      // Approach 2: Preserve complete paragraphs up to the limit
      const paragraphs = responseText.split('\n\n');
      let result = '';
      
      for (const p of paragraphs) {
        if ((result + p).length <= charLimit) {
          result += p + '\n\n';
        } else {
          // For the last paragraph, see if we can include a partial paragraph
          // that ends at a sentence boundary
          const remainingChars = charLimit - result.length;
          if (remainingChars > 80) { // Only if we have room for a meaningful partial
            const partialParagraph = p.substring(0, remainingChars);
            const lastSentence = partialParagraph.match(/.*[.!?]/);
            if (lastSentence) {
              result += lastSentence[0] + '\n\n';
            }
          }
          break;
        }
      }
      
      // Remove trailing newlines
      return result.trim();
    }
    
    return responseText;
  }
}
