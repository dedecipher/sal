'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useSalSdk } from '../hooks/useSalSdk';
import Navbar from '../components/Navbar';
import AudioVisualizer from '../components/AudioVisualizer';
import { useWallet } from '../hooks/useWallet';

export default function Home() {
  const {
    mode,
    switchMode,
    isInitialized,
    messages,
    sendMessage,
    isSending,
    error: sdkError,
    initialize,
    connectToHost,
    isConnecting
  } = useSalSdk();

  // Wallet connection
  const {
    walletState,
    error: walletError,
    connect,
    disconnect
  } = useWallet();

  // Panel logs
  const [hostLog, setHostLog] = useState<string[]>([]);
  const [clientLog, setClientLog] = useState<string[]>([]);
  
  // Form inputs
  const [hostAddress, setHostAddress] = useState<string>('demohost');
  const [messageText, setMessageText] = useState<string>('');
  
  // Status
  const [audioActivated, setAudioActivated] = useState<boolean>(false);
  
  // Panel states
  const [hostActive, setHostActive] = useState<boolean>(false);
  const [clientConnected, setClientConnected] = useState<boolean>(false);
  
  // Audio context and source for visualizer
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [audioSource, setAudioSource] = useState<MediaStreamAudioSourceNode | null>(null);
  
  // Refs for logging panels
  const hostLogRef = useRef<HTMLDivElement>(null);
  const clientLogRef = useRef<HTMLDivElement>(null);
  const messagesLogRef = useRef<HTMLDivElement>(null);

  // Handle wallet connection
  const handleWalletConnect = () => {
    if (walletState.connected) {
      disconnect();
    } else {
      connect();
    }
  };

  // Initialize audio
  const activateAudio = async () => {
    try {
      const newAudioContext = new AudioContext();
      setAudioContext(newAudioContext);
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const source = newAudioContext.createMediaStreamSource(stream);
      setAudioSource(source);
      
      setAudioActivated(true);
      addHostLog('info', '오디오 활성화됨');
      addClientLog('info', '오디오 활성화됨');
    } catch (err) {
      console.error('오디오 활성화 실패:', err);
      addHostLog('error', `오디오 활성화 실패: ${err instanceof Error ? err.message : String(err)}`);
      addClientLog('error', `오디오 활성화 실패: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // Start host
  const startHost = async () => {
    try {
      switchMode('HOST');
      await initialize();
      setHostActive(true);
      addHostLog('info', '호스트가 시작되었습니다.');
      addHostLog('info', '클라이언트 연결 대기 중...');
    } catch (err) {
      addHostLog('error', `호스트 시작 실패: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // Stop host
  const stopHost = () => {
    setHostActive(false);
    addHostLog('info', '호스트가 중지되었습니다.');
  };

  // Connect client to host
  const connectClient = async () => {
    try {
      switchMode('CLIENT');
      await initialize();
      addClientLog('info', '클라이언트 초기화됨');
      
      addClientLog('request', `호스트 "${hostAddress}"에 연결 시도 중...`);
      await connectToHost(hostAddress);
      setClientConnected(true);
      addClientLog('response', '호스트에 연결되었습니다!');
    } catch (err) {
      addClientLog('error', `호스트 연결 실패: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // Disconnect client
  const disconnectClient = () => {
    setClientConnected(false);
    addClientLog('info', '호스트와 연결이 해제되었습니다.');
  };

  // Send message
  const handleSendMessage = async () => {
    if (!messageText.trim()) return;
    
    try {
      addClientLog('request', `메시지 전송: "${messageText}"`);
      await sendMessage(messageText);
      setMessageText('');
      addClientLog('response', '메시지 전송 성공!');
    } catch (err) {
      addClientLog('error', `메시지 전송 실패: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // Add log entry to host panel
  const addHostLog = (type: 'info' | 'request' | 'response' | 'error', message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setHostLog(prev => [...prev, `[${timestamp}] [${type.toUpperCase()}] ${message}`]);
    
    // Auto scroll
    setTimeout(() => {
      if (hostLogRef.current) {
        hostLogRef.current.scrollTop = hostLogRef.current.scrollHeight;
      }
    }, 10);
  };

  // Add log entry to client panel
  const addClientLog = (type: 'info' | 'request' | 'response' | 'error', message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setClientLog(prev => [...prev, `[${timestamp}] [${type.toUpperCase()}] ${message}`]);
    
    // Auto scroll
    setTimeout(() => {
      if (clientLogRef.current) {
        clientLogRef.current.scrollTop = clientLogRef.current.scrollHeight;
      }
    }, 10);
  };

  // Monitor messages to update logs
  useEffect(() => {
    if (messages.length > 0) {
      const latestMessage = messages[messages.length - 1];
      if (latestMessage.sender === 'me') {
        addClientLog('info', `메시지 전송됨: "${latestMessage.text}"`);
      } else {
        addHostLog('info', `메시지 수신됨: "${latestMessage.text}"`);
      }
      
      // Auto scroll messages panel
      setTimeout(() => {
        if (messagesLogRef.current) {
          messagesLogRef.current.scrollTop = messagesLogRef.current.scrollHeight;
        }
      }, 10);
    }
  }, [messages]);

  // Update UI based on SDK state
  useEffect(() => {
    if (sdkError) {
      if (mode === 'HOST') {
        addHostLog('error', `오류: ${sdkError}`);
      } else {
        addClientLog('error', `오류: ${sdkError}`);
      }
    }
  }, [sdkError, mode]);

  return (
    <div className="flex flex-col min-h-screen bg-gray-900 text-white">
      <Navbar 
        mode={mode}
        onModeChange={switchMode}
        onConnectWallet={handleWalletConnect}
        isWalletConnected={walletState.connected}
        walletAddress={walletState.publicKey?.toString()}
      />
      
      <div className="container mx-auto px-4 py-6 flex-1 flex flex-col gap-6">
        {/* 메시지 모니터링 패널 */}
        <div className="bg-gray-800 p-4 rounded-lg border border-purple-800 shadow-lg">
          <h2 className="text-xl font-semibold mb-2 text-purple-300">Messages</h2>
          <div 
            ref={messagesLogRef}
            className="bg-gray-900 border border-gray-700 rounded-lg p-4 h-[150px] overflow-y-auto font-mono text-sm"
          >
            {messages.length === 0 ? (
              <div className="text-gray-500 text-center italic">아직 주고받은 메시지가 없습니다</div>
            ) : (
              messages.map((msg, index) => (
                <div 
                  key={index} 
                  className={`mb-2 p-2 rounded ${
                    msg.sender === 'me' 
                      ? 'bg-purple-900/40 border-l-4 border-purple-500 ml-10' 
                      : 'bg-indigo-900/40 border-l-4 border-indigo-500 mr-10'
                  }`}
                >
                  <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span>{msg.sender === 'me' ? '보냄' : '받음'}</span>
                    <span>{new Date(msg.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <div className="break-words">{msg.text}</div>
                </div>
              ))
            )}
          </div>
        </div>
        
        {/* 메인 콘텐츠 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 왼쪽 패널: 오디오 시각화 & 호스트 컨트롤 */}
          <div className="flex flex-col gap-4">
            <div className="bg-gray-800 p-4 rounded-lg border border-purple-800 shadow-lg">
              <h2 className="text-lg font-semibold mb-2 text-purple-300">Host</h2>
              <div className="mb-4">
                <div className="font-medium mb-2">
                  상태: <span className={`${hostActive ? 'text-green-400' : 'text-red-400'}`}>
                    {hostActive ? '활성' : '비활성'}
                  </span>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={startHost}
                    disabled={hostActive || !audioActivated}
                    className={`px-4 py-2 rounded-lg font-medium transition-all ${
                      hostActive || !audioActivated
                        ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                        : 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-700 hover:to-indigo-700'
                    }`}
                  >
                    호스트 시작
                  </button>
                  <button 
                    onClick={stopHost}
                    disabled={!hostActive}
                    className={`px-4 py-2 rounded-lg font-medium transition-all ${
                      !hostActive
                        ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                        : 'bg-gradient-to-r from-red-600 to-pink-600 text-white hover:from-red-700 hover:to-pink-700'
                    }`}
                  >
                    호스트 중지
                  </button>
                </div>
              </div>
              
              <div 
                ref={hostLogRef}
                className="bg-gray-900 border border-gray-700 rounded-lg p-3 h-[200px] overflow-y-auto font-mono text-xs"
              >
                {hostLog.map((log, index) => (
                  <div key={index} className="mb-1">{log}</div>
                ))}
              </div>

            {!audioActivated ? (
              <div className="bg-gray-800 p-6 rounded-lg border border-purple-800 shadow-lg flex items-center justify-center">
                <button 
                  onClick={activateAudio}
                  className="px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-medium rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-all shadow-lg"
                >
                  🔊 오디오 활성화하기
                </button>
              </div>
            ) : (
              <AudioVisualizer 
                audioContext={audioContext}
                audioSource={audioSource}
              />
            )}
            
            {/* 호스트 패널 */}
            </div>
          </div>
          
          {/* 오른쪽 패널: 클라이언트 컨트롤 */}
          <div className="bg-gray-800 p-4 rounded-lg border border-purple-800 shadow-lg">
            <h2 className="text-lg font-semibold mb-2 text-purple-300">Client</h2>
            <div className="mb-4">
              <div className="font-medium mb-2">
                상태: <span className={`${clientConnected ? 'text-green-400' : 'text-red-400'}`}>
                  {clientConnected ? '연결됨' : '연결 안됨'}
                </span>
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">
                  호스트 주소:
                </label>
                <input 
                  type="text" 
                  value={hostAddress}
                  onChange={(e) => setHostAddress(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-3 mb-4">
                <button 
                  onClick={connectClient}
                  disabled={clientConnected || !audioActivated}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    clientConnected || !audioActivated
                      ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                      : 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-700 hover:to-indigo-700'
                  }`}
                >
                  호스트에 연결
                </button>
                <button 
                  onClick={disconnectClient}
                  disabled={!clientConnected}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    !clientConnected
                      ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                      : 'bg-gradient-to-r from-red-600 to-pink-600 text-white hover:from-red-700 hover:to-pink-700'
                  }`}
                >
                  연결 해제
                </button>
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">
                  메시지:
                </label>
                <textarea 
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder="전송할 메시지를 입력하세요"
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent h-[100px] resize-none"
                />
                <button 
                  onClick={handleSendMessage}
                  disabled={!clientConnected || !messageText.trim()}
                  className={`w-full mt-2 px-4 py-2 rounded-lg font-medium transition-all ${
                    !clientConnected || !messageText.trim()
                      ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                      : 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-700 hover:to-indigo-700'
                  }`}
                >
                  메시지 전송 {isSending && '...'}
                </button>
              </div>
              
              <div 
                ref={clientLogRef}
                className="bg-gray-900 border border-gray-700 rounded-lg p-3 h-[200px] overflow-y-auto font-mono text-xs"
              >
                {clientLog.map((log, index) => (
                  <div key={index} className="mb-1">{log}</div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="bg-gray-800 py-2 px-4 text-center text-xs text-gray-400">
        SAL 오디오 메시지 트랜스포트 데모 v0.1.0 | 오디오 상태: {audioActivated ? '활성화됨' : '비활성화'} | SDK 상태: {isInitialized ? '초기화됨' : '초기화 필요'}
      </div>
    </div>
  );
}
