 import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Send } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { formatAgentName, getAgentColor, getAgentIndicatorColor } from '@/lib/utils';

// Define agent type
interface Agent {
  id: string;
  name: string;
}

export default function MultiAgentChat() {
  const [message, setMessage] = useState('');
  const [conversation, setConversation] = useState<{ agent: string; message: string }[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Fetch agents to display their avatars and names
  const { data: agentsData } = useQuery({
    queryKey: ["agents"],
    queryFn: () => apiClient.getAgents(),
    refetchInterval: 5000
  });
  
  // Filter out Eliza from agents list
  const agents = React.useMemo(() => {
    if (!agentsData?.agents) return [];
    
    return agentsData.agents.filter((agent: Agent) => 
      agent.name !== "Eliza" && 
      (agent.name === "Analyst Alex" || 
       agent.name === "Curious Clara" || 
       agent.name === "Strategic Sam")
    );
  }, [agentsData]);

  // Function to display shortened agent names in the header
  const getShortName = (agentName: string) => {
    if (agentName === "Analyst Alex") return "Alex";
    if (agentName === "Curious Clara") return "Clara";
    if (agentName === "Strategic Sam") return "Sam";
    return agentName;
  };

  // Function to get chat bubble background color based on agent name with custom RGB values
  const getChatBubbleColor = (agentName: string) => {
    const colors: Record<string, string> = {
      "Analyst Alex": "rgb(58, 72, 114)", // Custom RGB for Alex
      "Curious Clara": "rgb(87, 59, 109)", // Custom RGB for Clara
      "Strategic Sam": "rgb(219, 39, 119)", // Custom RGB for Sam
      "You": "rgb(16, 39, 92)", // Custom RGB for user
      "System": "bg-gray-800" // Keep system messages neutral
    };
    return colors[agentName] || "bg-gray-800";
  };

  const sendMessage = async () => {
    if (!message.trim() || loading) return;
    
    // Add user message to conversation
    const userMessage = { agent: "You", message: message.trim() };
    setConversation(prev => [...prev, userMessage]);
    
    setLoading(true);
    try {
      console.log("[MultiAgentChat] Sending message to API:", message.trim());
      console.log("[MultiAgentChat] Session state:", {
        conversationLength: conversation.length,
        timestamp: new Date().toISOString()
      });
      const apiUrl = import.meta.env.VITE_API_URL || 'https://app.getunifai.com:3000';
      console.log("[MultiAgentChat] Using API URL:", apiUrl);
      
      const response = await fetch(`${apiUrl}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: message.trim() })
      });
      
      console.log("[MultiAgentChat] API response status:", response.status);
      
      if (!response.ok) {
        console.error("[MultiAgentChat] Server returned error status:", response.status);
        throw new Error(`Server error: ${response.status}`);
      }
      
      const data = await response.json();
      console.log("[MultiAgentChat] API response data:", {
        hasConversation: !!data.conversation,
        responseCount: data.conversation?.length || 0,
        agents: data.conversation?.map((r: any) => r.agent) || []
      });
      
      // Handle empty conversation
      if (!data.conversation || !Array.isArray(data.conversation) || data.conversation.length === 0) {
        console.warn("[MultiAgentChat] Received empty conversation array from API");
        console.warn("[MultiAgentChat] Raw API response:", JSON.stringify(data));
        setConversation(prev => [
          ...prev, 
          { agent: 'System', message: 'The agents are currently unavailable. Please try again later.' }
        ]);
        return;
      }
      
      // Add agent responses to conversation
      setConversation(prev => [...prev, ...data.conversation]);
    } catch (error) {
      console.error('[MultiAgentChat] Error fetching conversation:', error instanceof Error ? error.message : String(error));
      if (error instanceof Error && error.stack) {
        console.error('[MultiAgentChat] Error stack:', error.stack);
      }
      setConversation(prev => [
        ...prev, 
        { agent: 'System', message: `Error connecting to agents: ${error instanceof Error ? error.message : String(error)}` }
      ]);
    } finally {
      setLoading(false);
      setMessage('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col h-full max-h-[100vh]">
      <div className="flex items-center space-x-4 p-4 border-b mb-1 md:mb-4">
        <div className="flex items-center space-x-2">
          <img 
            alt="unifai-icon" 
            src="/unifai-logo.jpg" 
            width="28" 
            height="28" 
            className="rounded-full" 
          />
          <h1 className="text-2xl font-bold">Unifai</h1>
        </div>
        <div className="flex space-x-2">
          {agents.map((agent: Agent) => (
            <div key={agent.id} className="flex items-center space-x-1">
              <div className={`w-3 h-3 rounded-full ${getAgentIndicatorColor(agent.name)}`}></div>
              <span className="text-sm">{getShortName(agent.name)}</span>
            </div>
          ))}
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
        {conversation.length === 0 ? (
          <div className="text-center text-gray-500 my-8">
            <p>Ask a question and all three experts will respond with their unique perspectives.</p>
          </div>
        ) : (
          conversation.map((msg, index) => (
            <div 
              key={index} 
              className={`flex items-start space-x-3 ${msg.agent === 'You' ? 'justify-end' : ''}`}
            >
              {msg.agent !== 'You' && (
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white ${getAgentColor(msg.agent)}`}>
                  {formatAgentName(msg.agent)}
                </div>
              )}
              
              <div 
                className="max-w-[75%] rounded-lg p-3"
                style={{ backgroundColor: getChatBubbleColor(msg.agent) }}
              >
                <div className="font-medium mb-1">{msg.agent}</div>
                <div className="text-sm whitespace-pre-wrap">{msg.message}</div>
              </div>
              
              {msg.agent === 'You' && (
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white"
                     style={{ backgroundColor: "rgb(16, 39, 92)" }}>
                  You
                </div>
              )}
            </div>
          ))
        )}
        
        {loading && (
          <div className="flex items-start space-x-3">
            <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center">
              <span className="animate-pulse">...</span>
            </div>
            <div className="max-w-[75%] rounded-lg p-3 bg-gray-800">
              <div className="font-medium mb-1">Unifai</div>
              <div className="flex space-x-1">
                <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '200ms' }}></div>
                <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '400ms' }}></div>
              </div>
            </div>
          </div>
        )}
      </div>
      
      <div className="p-2 md:p-4 border-t">
        <div className="flex space-x-2">
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Ask the Unifai Think Tank..."
            disabled={loading}
            className="flex-1"
          />
          <Button 
            onClick={sendMessage} 
            disabled={loading || !message.trim()}
            variant="branded"
          >
            <Send size={18} />
          </Button>
        </div>
      </div>
    </div>
  );
}
