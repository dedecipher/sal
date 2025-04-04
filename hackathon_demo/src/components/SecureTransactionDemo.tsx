'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import {
  GibberLink,
  SecureMessaging,
  SolanaClient,
  DirectoryService,
  AgentIdentity,
  TransactionPayload,
  MessageType
} from 'gibberlink-sdk';
import AudioMotionAnalyzer from 'audiomotion-analyzer';
import Script from 'next/script';

// Mock agent identities for demo
const DEMO_AGENTS = {
  alice: {
    id: 'agent-alice',
    publicKey: 'fake-key-alice-12345',
    name: 'Alice (Agent A)',
    phoneNumber: '+1-555-123-4567'
  },
  bob: {
    id: 'agent-bob',
    publicKey: 'fake-key-bob-67890',
    name: 'Bob (Agent B)',
    phoneNumber: '+1-555-987-6543'
  }
};

// Directory service URL (mocked for demo)
const DIRECTORY_URL = 'https://mock-agent-directory.example.com/api';

export default function SecureTransactionDemo() {
  const [mounted, setMounted] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<'alice' | 'bob'>('alice');
  const [targetAgent, setTargetAgent] = useState<'alice' | 'bob'>('bob');
  const [amount, setAmount] = useState<number>(0.01);
  const [memo, setMemo] = useState<string>('Test payment');
  const [status, setStatus] = useState<string>('Idle');
  const [logs, setLogs] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const gibberlinkRef = useRef<GibberLink | null>(null);
  const secureMessagingRef = useRef<SecureMessaging | null>(null);
  const solanaClientRef = useRef<SolanaClient | null>(null);
  const directoryServiceRef = useRef<DirectoryService | null>(null);
  const audioMotionRef = useRef<AudioMotionAnalyzer | null>(null);
  
  // Add a log entry
  const addLog = (message: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
  };
  
  // Initialize the SDK components
  useEffect(() => {
    if (mounted && !gibberlinkRef.current) {
      // Initialize GibberLink
      gibberlinkRef.current = new GibberLink({ autoInit: true });
      
      // Initialize Directory Service
      directoryServiceRef.current = new DirectoryService({
        serviceUrl: DIRECTORY_URL
      });
      
      // Initialize Solana Client with the selected agent identity
      const agentIdentity = DEMO_AGENTS[selectedAgent];
      solanaClientRef.current = new SolanaClient({
        rpcEndpoint: 'https://api.devnet.solana.com',
        agentIdentity,
        directoryService: directoryServiceRef.current
      });
      
      // Initialize Secure Messaging layer
      secureMessagingRef.current = new SecureMessaging({
        gibberlink: gibberlinkRef.current,
        solanaClient: solanaClientRef.current,
        directoryService: directoryServiceRef.current,
        agentIdentity
      });
      
      // Set up message listener
      secureMessagingRef.current.addMessageListener((event) => {
        switch (event.type) {
          case MessageType.TEXT:
            addLog(`Received text message from ${event.sender}: ${event.content}`);
            break;
            
          case MessageType.TRANSACTION_REQUEST:
            const request = event.content;
            addLog(`Received transaction request from ${event.sender}`);
            addLog(`Amount: ${request.payload.amount / 1000000} SOL`);
            addLog(`Memo: ${request.payload.memo || 'None'}`);
            
            // Auto-approve for demo purposes
            setTimeout(async () => {
              if (secureMessagingRef.current && solanaClientRef.current) {
                setStatus('Processing transaction...');
                addLog('Auto-approving transaction request...');
                
                try {
                  const response = await solanaClientRef.current.sendTransaction(request);
                  await secureMessagingRef.current.sendTransactionResponse(event.sender, response);
                  
                  addLog(`Transaction ${response.status}: ${response.signature || 'No signature'}`);
                  setStatus('Transaction processed');
                } catch (error) {
                  addLog(`Error processing transaction: ${error}`);
                  setStatus('Transaction failed');
                }
              }
            }, 2000);
            break;
            
          case MessageType.TRANSACTION_RESPONSE:
            const response = event.content;
            addLog(`Received transaction response from ${event.sender}`);
            addLog(`Status: ${response.status}`);
            if (response.signature) {
              addLog(`Signature: ${response.signature}`);
            }
            if (response.error) {
              addLog(`Error: ${response.error}`);
            }
            setStatus(`Transaction ${response.status}`);
            break;
        }
      });
      
      addLog('SDK components initialized');
    }
    
    return () => {
      // Clean up resources when component unmounts
      if (gibberlinkRef.current && isListening) {
        gibberlinkRef.current.stopListening();
      }
      
      if (audioMotionRef.current) {
        audioMotionRef.current.destroy();
      }
    };
  }, [mounted, selectedAgent]);
  
  // Change agent identity when user switches roles
  useEffect(() => {
    if (solanaClientRef.current && directoryServiceRef.current && secureMessagingRef.current) {
      const agentIdentity = DEMO_AGENTS[selectedAgent];
      
      solanaClientRef.current.setAgentIdentity(agentIdentity);
      secureMessagingRef.current.setAgentIdentity(agentIdentity);
      
      addLog(`Switched to agent: ${agentIdentity.name} (${agentIdentity.id})`);
    }
  }, [selectedAgent]);
  
  // Initialize AudioMotion visualization
  useEffect(() => {
    if (mounted && isListening && gibberlinkRef.current) {
      const analyserNode = gibberlinkRef.current.createAnalyserNode();
      
      if (analyserNode) {
        const container = document.getElementById('secure-audio-viz');
        if (container && !audioMotionRef.current) {
          audioMotionRef.current = new AudioMotionAnalyzer(container, {
            source: analyserNode,
            height: 200,
            width: 400,
            mode: 6, // Oscilloscope mode
            fillAlpha: 0.7,
            lineWidth: 2,
            showScaleX: false,
            showScaleY: false,
            reflexRatio: 0.2,
            showBgColor: false,
            showPeaks: true,
            gradient: 'rainbow',
            smoothing: 0.7,
          });
        }
      }
    }
    
    return () => {
      if (audioMotionRef.current) {
        audioMotionRef.current.destroy();
        audioMotionRef.current = null;
      }
    };
  }, [mounted, isListening]);
  
  useEffect(() => {
    setMounted(true);
  }, []);
  
  // Start or stop secure messaging
  const toggleListening = async () => {
    if (isListening) {
      if (secureMessagingRef.current) {
        await secureMessagingRef.current.stop();
        setIsListening(false);
        setStatus('Stopped');
        addLog('Stopped secure messaging');
      }
    } else {
      if (secureMessagingRef.current) {
        try {
          await secureMessagingRef.current.start();
          setIsListening(true);
          setStatus('Listening');
          addLog('Started secure messaging');
        } catch (error) {
          addLog(`Error starting secure messaging: ${error}`);
        }
      }
    }
  };
  
  // Send a secure text message
  const sendSecureMessage = async () => {
    if (!secureMessagingRef.current || !isListening) {
      addLog('Secure messaging not started');
      return;
    }
    
    setIsProcessing(true);
    try {
      const receiverId = DEMO_AGENTS[targetAgent].id;
      const message = `Hello from ${DEMO_AGENTS[selectedAgent].name}!`;
      
      addLog(`Sending secure message to ${DEMO_AGENTS[targetAgent].name}...`);
      const success = await secureMessagingRef.current.sendSecureTextMessage(receiverId, message);
      
      if (success) {
        addLog('Message sent successfully');
      } else {
        addLog('Failed to send message');
      }
    } catch (error) {
      addLog(`Error sending message: ${error}`);
    } finally {
      setIsProcessing(false);
    }
  };
  
  // Send a transaction request
  const sendTransactionRequest = async () => {
    if (!secureMessagingRef.current || !isListening) {
      addLog('Secure messaging not started');
      return;
    }
    
    setIsProcessing(true);
    try {
      const receiverId = DEMO_AGENTS[targetAgent].id;
      
      // Convert SOL to lamports (1 SOL = 1,000,000,000 lamports)
      const lamports = Math.floor(amount * 1_000_000_000);
      
      const payload: TransactionPayload = {
        amount: lamports,
        memo: memo || 'Payment',
        reference: `TXN-${Date.now()}`
      };
      
      addLog(`Sending transaction request to ${DEMO_AGENTS[targetAgent].name}...`);
      addLog(`Amount: ${amount} SOL (${lamports} lamports)`);
      addLog(`Memo: ${payload.memo}`);
      
      setStatus('Sending transaction request...');
      const success = await secureMessagingRef.current.sendTransactionRequest(receiverId, payload);
      
      if (success) {
        addLog('Transaction request sent successfully');
        setStatus('Transaction request sent');
      } else {
        addLog('Failed to send transaction request');
        setStatus('Failed to send request');
      }
    } catch (error) {
      addLog(`Error sending transaction request: ${error}`);
      setStatus('Error');
    } finally {
      setIsProcessing(false);
    }
  };
  
  // Clear the logs
  const clearLogs = () => {
    setLogs([]);
  };
  
  if (!mounted) {
    return null;
  }
  
  return (
    <>
      <Script src="/ggwave/ggwave.js" strategy="afterInteractive" />
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-4">Secure Transaction Demo</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-slate-800 p-4 rounded-lg">
            <h2 className="text-xl font-semibold mb-4">Agent Configuration</h2>
            
            <div className="mb-4">
              <label className="block mb-2">Your Agent Identity</label>
              <div className="flex gap-4">
                <Button
                  variant={selectedAgent === 'alice' ? 'default' : 'outline'}
                  onClick={() => setSelectedAgent('alice')}
                  disabled={isListening}
                >
                  Alice (Agent A)
                </Button>
                <Button
                  variant={selectedAgent === 'bob' ? 'default' : 'outline'}
                  onClick={() => setSelectedAgent('bob')}
                  disabled={isListening}
                >
                  Bob (Agent B)
                </Button>
              </div>
            </div>
            
            <div className="mb-4">
              <label className="block mb-2">Target Agent</label>
              <div className="flex gap-4">
                <Button
                  variant={targetAgent === 'alice' ? 'default' : 'outline'}
                  onClick={() => setTargetAgent('alice')}
                  disabled={selectedAgent === 'alice'}
                >
                  Alice (Agent A)
                </Button>
                <Button
                  variant={targetAgent === 'bob' ? 'default' : 'outline'}
                  onClick={() => setTargetAgent('bob')}
                  disabled={selectedAgent === 'bob'}
                >
                  Bob (Agent B)
                </Button>
              </div>
            </div>
            
            <div className="mb-4">
              <Button 
                onClick={toggleListening}
                className="w-full"
                variant={isListening ? 'destructive' : 'default'}
              >
                {isListening ? 'Stop Secure Messaging' : 'Start Secure Messaging'}
              </Button>
            </div>
            
            <div className="mb-4">
              <p className="text-sm">Status: <span className="font-semibold">{status}</span></p>
            </div>
            
            <div className="mb-4">
              <h3 className="text-lg font-medium mb-2">Audio Visualization</h3>
              <div 
                id="secure-audio-viz" 
                className="bg-slate-900 rounded-lg h-[200px] w-full"
                style={{ display: isListening ? 'block' : 'none' }}
              ></div>
              {!isListening && (
                <p className="text-center py-12 text-slate-400 bg-slate-900 rounded-lg">
                  Start secure messaging to see visualization
                </p>
              )}
            </div>
          </div>
          
          <div className="bg-slate-800 p-4 rounded-lg">
            <h2 className="text-xl font-semibold mb-4">Transaction Actions</h2>
            
            <div className="mb-4">
              <Button
                onClick={sendSecureMessage}
                className="w-full mb-2"
                disabled={!isListening || isProcessing}
              >
                Send Secure Text Message
              </Button>
            </div>
            
            <div className="mb-6">
              <label className="block mb-2">Payment Amount (SOL)</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                min="0.000001"
                step="0.01"
                className="w-full p-2 rounded-md bg-slate-700"
              />
            </div>
            
            <div className="mb-6">
              <label className="block mb-2">Memo</label>
              <input
                type="text"
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                className="w-full p-2 rounded-md bg-slate-700"
                placeholder="Payment for goods"
              />
            </div>
            
            <div className="mb-4">
              <Button
                onClick={sendTransactionRequest}
                className="w-full"
                disabled={!isListening || isProcessing || amount <= 0}
                variant="default"
              >
                Send Transaction Request
              </Button>
            </div>
            
            <div className="mt-6">
              <h3 className="text-lg font-medium mb-2">Event Log</h3>
              <div className="bg-slate-900 rounded-lg p-2 h-[200px] overflow-y-auto">
                {logs.length > 0 ? (
                  logs.map((log, index) => (
                    <div key={index} className="text-xs mb-1 text-slate-300">
                      {log}
                    </div>
                  ))
                ) : (
                  <p className="text-center py-6 text-slate-400">No events yet</p>
                )}
              </div>
              <div className="mt-2">
                <Button
                  onClick={clearLogs}
                  variant="outline"
                  size="sm"
                  className="text-xs"
                >
                  Clear Log
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
} 