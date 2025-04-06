'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useSalSdk } from '../hooks/useSalSdk';
import Navbar from '../components/Navbar';
import AudioVisualizer from '../components/AudioVisualizer';
import MessagePanel from '../components/MessagePanel';
import ConnectionLogs from '../components/ConnectionLogs';
import { useWallet } from '../hooks/useWallet';

export default function Home() {
  // Wallet connection
  const {
    walletState,
    connect,
    disconnect
  } = useWallet();

  // 호스트와 클라이언트를 위한 별도의 상태와 로그 관리
  // 상태
  const [hostActive, setHostActive] = useState<boolean>(false);
  const [clientConnected, setClientConnected] = useState<boolean>(false);
  const [audioActivated, setAudioActivated] = useState<boolean>(true);
  
  // 로그
  const [hostLog, setHostLog] = useState<string[]>([]);
  const [clientLog, setClientLog] = useState<string[]>([]);
  const [messages, setMessages] = useState<{ sender: 'host' | 'client'; text: string; timestamp: number }[]>([]);
  
  // 폼 입력
  const [hostAddress, setHostAddress] = useState<string>('demohost');
  const [messageText, setMessageText] = useState<string>('');
  
  // 오디오 컨텍스트 및 비주얼라이저 용 소스
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [audioSource, setAudioSource] = useState<MediaStreamAudioSourceNode | null>(null);
  
  // 로깅 패널용 refs
  const hostLogRef = useRef<HTMLDivElement>(null);
  const clientLogRef = useRef<HTMLDivElement>(null);
  const messagesLogRef = useRef<HTMLDivElement>(null);

  // 호스트 SDK 인스턴스
  const {
    isInitialized: isHostInitialized,
    messages: hostMessages,
    sendMessage: hostSendMessage,
    isSending: isHostSending,
    error: hostSdkError,
    initialize: initializeHost,
  } = useSalSdk();

  // 클라이언트 SDK 인스턴스 (2번째 인스턴스 생성)
  const {
    messages: clientMessages,
    sendMessage: clientSendMessage,
    isSending: isClientSending,
    error: clientSdkError,
    initialize: initializeClient,
    connectToHost,
    isInitialized: isClientInitialized,
    connectionLogs,
    clearConnectionLogs,
    isConnecting,
  } = useSalSdk();

  // Wallet 연결 처리
  const handleWalletConnect = () => {
    if (walletState.connected) {
      disconnect();
    } else {
      connect();
    }
  };

  // 오디오 초기화
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

  // 호스트 시작
  const startHost = async () => {
    try {
      await initializeHost('HOST');
      setHostActive(true);
      addHostLog('info', '호스트가 시작되었습니다.');
      addHostLog('info', '클라이언트 연결 대기 중...');
    } catch (err) {
      addHostLog('error', `호스트 시작 실패: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // 호스트 중지
  const stopHost = () => {
    setHostActive(false);
    addHostLog('info', '호스트가 중지되었습니다.');
  };

  // 클라이언트 연결
  const connectClient = async () => {
    try {
      await initializeClient('CLIENT');
      addClientLog('info', '클라이언트 초기화됨');
      
      addClientLog('request', `호스트 "${hostAddress}"에 연결 시도 중...`);
      clearConnectionLogs(); // 새 연결 시도 전에 로그 초기화
      
      await connectToHost(hostAddress, '+12345678901', () => {
        setClientConnected(true);
        addClientLog('response', '호스트에 연결되었습니다!');
      });
    } catch (err) {
      addClientLog('error', `호스트 연결 실패: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // 클라이언트 연결 해제
  const disconnectClient = () => {
    setClientConnected(false);
    addClientLog('info', '호스트와 연결이 해제되었습니다.');
  };

  // 호스트로부터 메시지 전송
  const handleHostSendMessage = async () => {
    if (!messageText.trim()) return;
    
    try {
      addHostLog('request', `메시지 전송: "${messageText}"`);
      await hostSendMessage(messageText);
      setMessages(prev => [...prev, { sender: 'host', text: messageText, timestamp: Date.now() }]);
      setMessageText('');
      addHostLog('response', '메시지 전송 성공!');
    } catch (err) {
      addHostLog('error', `메시지 전송 실패: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // 클라이언트로부터 메시지 전송
  const handleClientSendMessage = async () => {
    if (!messageText.trim()) return;
    
    try {
      addClientLog('request', `메시지 전송: "${messageText}"`);
      await clientSendMessage(messageText);
      setMessages(prev => [...prev, { sender: 'client', text: messageText, timestamp: Date.now() }]);
      setMessageText('');
      addClientLog('response', '메시지 전송 성공!');
    } catch (err) {
      addClientLog('error', `메시지 전송 실패: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // 호스트 로그 항목 추가
  const addHostLog = (type: 'info' | 'request' | 'response' | 'error', message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setHostLog(prev => [...prev, `[${timestamp}] [${type.toUpperCase()}] ${message}`]);
    
    // 자동 스크롤
    setTimeout(() => {
      if (hostLogRef.current) {
        hostLogRef.current.scrollTop = hostLogRef.current.scrollHeight;
      }
    }, 10);
  };

  // 클라이언트 로그 항목 추가
  const addClientLog = (type: 'info' | 'request' | 'response' | 'error', message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setClientLog(prev => [...prev, `[${timestamp}] [${type.toUpperCase()}] ${message}`]);
    
    // 자동 스크롤
    setTimeout(() => {
      if (clientLogRef.current) {
        clientLogRef.current.scrollTop = clientLogRef.current.scrollHeight;
      }
    }, 10);
  };
  
  // 호스트 메시지 모니터링
  useEffect(() => {
    if (hostMessages.length > 0) {
      const latestMessage = hostMessages[hostMessages.length - 1];
      
      if (latestMessage.sender === 'other') {
        addHostLog('info', `메시지 수신됨: "${latestMessage.text}"`);
        setMessages(prev => [...prev, { 
          sender: 'client', 
          text: latestMessage.text, 
          timestamp: latestMessage.timestamp 
        }]);
      }
      
      // 자동 스크롤
      setTimeout(() => {
        if (messagesLogRef.current) {
          messagesLogRef.current.scrollTop = messagesLogRef.current.scrollHeight;
        }
      }, 10);
    }
  }, [hostMessages]);
  
  // 클라이언트 메시지 모니터링
  useEffect(() => {
    if (clientMessages.length > 0) {
      const latestMessage = clientMessages[clientMessages.length - 1];
      
      if (latestMessage.sender === 'other') {
        addClientLog('info', `메시지 수신됨: "${latestMessage.text}"`);
        setMessages(prev => [...prev, { 
          sender: 'host', 
          text: latestMessage.text, 
          timestamp: latestMessage.timestamp 
        }]);
      }
      
      // 자동 스크롤
      setTimeout(() => {
        if (messagesLogRef.current) {
          messagesLogRef.current.scrollTop = messagesLogRef.current.scrollHeight;
        }
      }, 10);
    }
  }, [clientMessages]);
  
  // 호스트 에러 모니터링
  useEffect(() => {
    if (hostSdkError) {
      addHostLog('error', hostSdkError);
    }
  }, [hostSdkError]);
  
  // 클라이언트 에러 모니터링
  useEffect(() => {
    if (clientSdkError) {
      addClientLog('error', clientSdkError);
    }
  }, [clientSdkError]);

  return (
    <main className="flex min-h-screen flex-col bg-gray-900 text-gray-100">
      {/* 네비게이션 바 */}
      <Navbar 
        mode="CLIENT"
        onModeChange={() => {}}
        onConnectWallet={handleWalletConnect}
        isWalletConnected={walletState.connected}
        walletAddress={walletState.publicKey?.toString()}
      />
      
      <div className="container mx-auto px-4 py-6 flex-1 flex flex-col gap-6">
        {/* 메시지 모니터링 패널 */}
        <div className="bg-gray-800 p-4 rounded-lg border border-purple-800 shadow-lg">
          <h2 className="text-xl font-semibold mb-2 text-purple-300">Communication Logs</h2>
          <div 
            ref={messagesLogRef}
            className="bg-gray-900 border border-gray-700 rounded-lg p-4 h-[300px] overflow-y-auto font-mono text-sm"
          >
            <ConnectionLogs 
              logs={connectionLogs.filter(log => log.text.includes('청크 수신'))}
              onClear={clearConnectionLogs}
            />
            {/* {messages.length === 0 ? (
              <div className="text-gray-500 text-center italic">아직 주고받은 메시지가 없습니다</div>
            ) : (
              messages.map((msg, index) => (
                <div 
                  key={index} 
                  className={`mb-2 p-2 rounded ${
                    msg.sender === 'host' 
                      ? 'bg-purple-900/40 border-l-4 border-purple-500 ml-10' 
                      : 'bg-indigo-900/40 border-l-4 border-indigo-500 mr-10'
                  }`}
                >
                  <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span>{msg.sender === 'host' ? '호스트' : '클라이언트'}</span>
                    <span>{new Date(msg.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <div className="break-words">{msg.text}</div>
                </div>
              ))
            )} */}
          </div>
        </div>
        
        {/* 오디오 초기화 버튼 */}
        {/* {!audioActivated && (
          <div className="bg-gray-800 p-6 rounded-lg border border-purple-800 shadow-lg flex items-center justify-center">
            <button 
              onClick={activateAudio}
              className="px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-medium rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-all shadow-lg"
            >
              🔊 오디오 활성화하기 (시작하려면 클릭하세요)
            </button>
          </div>
        )} */}

        {/* {audioActivated && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <AudioVisualizer 
              audioContext={audioContext}
              audioSource={audioSource}
            />
          </div>
        )} */}
        
        {/* 연결 로그 패널 - 새로 추가 */}
        {/* <div className="h-[300px]">
          <ConnectionLogs 
            logs={connectionLogs}
            onClear={clearConnectionLogs}
          />
        </div> */}
        
        {/* 메인 컨텐츠 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 왼쪽 패널: 호스트 컨트롤 */}
          <div className="bg-gray-800 p-4 rounded-lg border border-purple-800 shadow-lg">
            <h2 className="text-lg font-semibold mb-2 text-purple-300">Host</h2>
            <div className="mb-4">
              <div className="font-medium mb-2">
                상태: <span className={`${hostActive ? 'text-green-400' : 'text-red-400'}`}>
                  {hostActive ? '활성' : '비활성'}
                </span>
              </div>
              
              <div className="grid grid-cols-2 gap-3 mb-4">
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

              {hostActive && (
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-1">
                    메시지 전송:
                  </label>
                  {/* <textarea 
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    placeholder="호스트로 전송할 메시지를 입력하세요"
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent h-[80px] resize-none"
                  /> */}
                  <button 
                    onClick={handleHostSendMessage}
                    disabled={!hostActive || !messageText.trim() || isHostSending}
                    className={`w-full mt-2 px-4 py-2 rounded-lg font-medium transition-all ${
                      !hostActive || !messageText.trim() || isHostSending
                        ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                        : 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-700 hover:to-indigo-700'
                    }`}
                  >
                    호스트로 전송 {isHostSending && '...'}
                  </button>
                </div>
              )}
              
              <div 
                ref={hostLogRef}
                className="bg-gray-900 border border-gray-700 rounded-lg p-3 h-[200px] overflow-y-auto font-mono text-xs"
              >
                {hostLog.map((log, index) => (
                  <div key={index} className="mb-1">{log}</div>
                ))}
              </div>
            </div>
          </div>
          
          {/* 오른쪽 패널: 클라이언트 컨트롤 */}
          <div className="bg-gray-800 p-4 rounded-lg border border-purple-800 shadow-lg">
            <h2 className="text-lg font-semibold mb-2 text-purple-300">Client</h2>
            <div className="mb-4">
              <div className="font-medium mb-2">
                상태: <span className={`${clientConnected ? 'text-green-400' : 'text-red-400'}`}>
                  {clientConnected ? '연결됨' : isConnecting ? '연결 중...' : '연결 안됨'}
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
                  disabled={clientConnected || isConnecting || !audioActivated}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    clientConnected || isConnecting || !audioActivated
                      ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                      : 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-700 hover:to-indigo-700'
                  }`}
                >
                  {isConnecting ? '연결 중...' : '호스트에 연결'}
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
              
              {clientConnected && (
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-1">
                    메시지 전송:
                  </label>
                  <textarea 
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    placeholder="클라이언트로 전송할 메시지를 입력하세요"
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent h-[80px] resize-none"
                  />
                  <button 
                    onClick={handleClientSendMessage}
                    disabled={!clientConnected || !messageText.trim() || isClientSending}
                    className={`w-full mt-2 px-4 py-2 rounded-lg font-medium transition-all ${
                      !clientConnected || !messageText.trim() || isClientSending
                        ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                        : 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-700 hover:to-indigo-700'
                    }`}
                  >
                    클라이언트로 전송 {isClientSending && '...'}
                  </button>
                </div>
              )}
              
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
        SAL 오디오 메시지 트랜스포트 데모 v0.1.0 | 오디오 상태: {audioActivated ? '활성화됨' : '비활성화'} | 
        호스트 상태: {isHostInitialized ? '초기화됨' : '초기화 필요'} | 
        클라이언트 상태: {isClientInitialized ? '초기화됨' : '초기화 필요'}
      </div>
    </main>
  );
}
