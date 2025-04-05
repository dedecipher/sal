import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';

export interface Message {
  id: string;
  text: string;
  sender: 'me' | 'other';
  timestamp: number;
}

interface MessagePanelProps {
  messages: Message[];
  onSendMessage: (text: string) => void;
  isSending: boolean;
}

export default function MessagePanel({ messages, onSendMessage, isSending }: MessagePanelProps) {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle send message
  const handleSendMessage = () => {
    const trimmedText = inputText.trim();
    if (trimmedText && !isSending) {
      onSendMessage(trimmedText);
      setInputText('');
    }
  };

  // Handle enter key press
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex flex-col w-full h-full bg-gray-900 rounded-xl overflow-hidden border border-gray-700 shadow-lg">
      <div className="p-3 bg-gray-800 text-white font-medium border-b border-gray-700">
        Messages
      </div>
      
      {/* Messages container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500 italic">
            No messages yet
          </div>
        ) : (
          messages.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${message.sender === 'me' ? 'justify-end' : 'justify-start'}`}
            >
              <div 
                className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                  message.sender === 'me' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-700 text-white'
                }`}
              >
                <div className="text-sm break-words">{message.text}</div>
                <div className="text-xs mt-1 opacity-70">
                  {new Date(message.timestamp).toLocaleTimeString()}
                </div>
              </div>
            </motion.div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>
      
      {/* Input area */}
      <div className="p-3 bg-gray-800 border-t border-gray-700">
        <div className="flex items-center space-x-2">
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Type a message..."
            className="flex-1 bg-gray-700 text-white rounded-lg p-2 min-h-[40px] max-h-[120px] outline-none resize-none"
            disabled={isSending}
          />
          <button
            onClick={handleSendMessage}
            disabled={!inputText.trim() || isSending}
            className={`px-4 py-2 rounded-lg text-white font-medium transition-all ${
              !inputText.trim() || isSending
                ? 'bg-gray-600 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {isSending ? 'Sending...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
} 