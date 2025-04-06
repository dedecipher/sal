import { useState, useCallback, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { AudioMessageTransport, SalClient, SalHost } from 'sal-sdk';
import { Message } from '../components/MessagePanel';
import { Keypair } from '@solana/web3.js';

// Define app mode type
export type AppMode = 'HOST' | 'CLIENT' | 'HOST & CLIENT';

// AudioContext 타입 정의
interface AudioContextWindow extends Window {
  webkitAudioContext?: typeof AudioContext;
}

// 로그 메시지 타입 정의
export interface ConnectionLog {
  id: string;
  text: string;
  type: 'info' | 'request' | 'response' | 'error';
  timestamp: number;
}

export const useSalSdk = () => {
  // Get initial mode from URL parameters
  const getInitialMode = (): AppMode => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const modeParam = params.get('mode')?.toUpperCase();
      if (modeParam === 'HOST' || modeParam === 'CLIENT') {
        return modeParam as AppMode;
      }
    }
    return 'CLIENT'; // Default to CLIENT if no valid parameter
  };

  // State variables
  const [mode, setMode] = useState<AppMode>(getInitialMode());
  const [isInitialized, setIsInitialized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionLogs, setConnectionLogs] = useState<ConnectionLog[]>([]);
  
  // Audio context and stream
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [audioSource, setAudioSource] = useState<MediaStreamAudioSourceNode | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  
  // SDK instances
  const clientRef = useRef<SalClient | null>(null);
  const hostRef = useRef<SalHost | null>(null);
  const keypairRef = useRef<Keypair>(Keypair.generate());
  const transportRef = useRef<AudioMessageTransport | null>(null);

  // 로그 메시지 추가 함수
  const addConnectionLog = useCallback((text: string, type: 'info' | 'request' | 'response' | 'error') => {
    setConnectionLogs(prev => [
      ...prev,
      {
        id: uuidv4(),
        text,
        type,
        timestamp: Date.now()
      }
    ]);
  }, []);

  // Initialize SDK based on mode
  const initialize = useCallback(async (initMode?: AppMode) => {
    try {
      // 모드 사용 우선순위: 함수에 전달된 모드 > 현재 상태 모드
      const targetMode = initMode || mode;
      setError(null);
      
      // 모드에 따라 초기화 대상 결정
      const shouldInitHost = targetMode === 'HOST' || targetMode === 'HOST & CLIENT';
      const shouldInitClient = targetMode === 'CLIENT' || targetMode === 'HOST & CLIENT';
      
      // 이미 초기화된 인스턴스에 따라 필요한 것만 초기화
      if (!shouldInitHost) hostRef.current = null;
      if (!shouldInitClient) clientRef.current = null;
      
      // Clean up previous audio resources
      if (audioSource) {
        audioSource.disconnect();
        setAudioSource(null);
      }
      
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(track => track.stop());
        audioStreamRef.current = null;
      }
      
      // AudioContext가 존재하고 닫히지 않은 상태인 경우에만 닫기
      if (audioContext && audioContext.state !== 'closed') {
        try {
          await audioContext.close();
        } catch (err) {
          console.warn('AudioContext 닫기 오류:', err);
        }
      }
      setAudioContext(null);
      
      // Create new audio context
      const newAudioContext = new (window.AudioContext || (window as AudioContextWindow).webkitAudioContext || AudioContext)();
      setAudioContext(newAudioContext);
      
      // Get user media
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;
      
      // Create audio source
      const source = newAudioContext.createMediaStreamSource(stream);
      setAudioSource(source);
      
      // Create transport
      const transport = new AudioMessageTransport({
        name: targetMode === 'HOST' ? 'HostTransport' : 'ClientTransport',
        sampleRate: newAudioContext.sampleRate
      });
      
      // Store transport reference
      transportRef.current = transport;
    
      // Initialize HOST if needed
      if (shouldInitHost) {
        // 호스트 모드 설정
        const hostConfig = {
          cluster: 'https://api.devnet.solana.com',
          phoneNumber: '+12345678901', // 데모용 가상 전화번호
          host: 'demohost',
          keyPair: keypairRef.current
        };
        
        // SalHost 인스턴스 생성
        hostRef.current = new SalHost(hostConfig, transport);
        
        // 커스텀 메시지 핸들러 등록 (간단한 텍스트 메시지 처리)
        hostRef.current.register({
          messageHandler: async (message) => {
            setMessages(prev => [
              ...prev,
              {
                id: uuidv4(),
                text: message,
                sender: 'other',
                timestamp: Date.now()
              }
            ]);
          }
        });
        
        // 호스트 시작
        await hostRef.current.run();
      }
      
      // Initialize CLIENT if needed
      if (shouldInitClient) {
        // 클라이언트 모드 - Solana 클러스터 및 키페어 설정
        const clientConfig = {
          cluster: 'https://api.devnet.solana.com',
          keyPair: keypairRef.current,
          testMode: true  // 데모용 테스트 모드 활성화
        };
        
        // SalClient 생성
        clientRef.current = new SalClient(clientConfig, transport);
        
        // 이벤트 리스너 추가 - 이벤트를 로그로 기록
        if (clientRef.current) {
          // 원래 콘솔 로그 함수 저장
          const originalConsoleLog = console.log;
          const originalConsoleError = console.error;

          // AudioMessageTransport와 관련된 로그만 캡처하기 위한 함수
          console.log = function(...args) {
            originalConsoleLog.apply(console, args);
            
            // 첫 번째 인수가 문자열이고 [ClientTransport] 또는 [HostTransport]를 포함하는 경우에만 처리
            if (typeof args[0] === 'string' && 
                (args[0].includes('[ClientTransport]') || 
                 args[0].includes('[HostTransport]') ||
                 args[0].includes('연결 응답'))) {
              const logText = args.join(' ');
              addConnectionLog(logText, 'info');
            }
          };

          console.error = function(...args) {
            originalConsoleError.apply(console, args);

            // 오류 로그 중 필요한 것만 캡처
            if (typeof args[0] === 'string' && 
                (args[0].includes('[ClientTransport]') || 
                 args[0].includes('[HostTransport]'))) {
              const logText = args.join(' ');
              addConnectionLog(logText, 'error');
            }
          };

          // EventEmitter 이벤트 리스너 추가
          clientRef.current.on('connected', (host) => {
            addConnectionLog(`호스트 ${host}에 연결됨`, 'info');
          });

          clientRef.current.on('error', (err) => {
            const errorMessage = err instanceof Error ? err.message : String(err);
            addConnectionLog(`오류 발생: ${errorMessage}`, 'error');
          });
        }
        
        // 클라이언트 이벤트 핸들러 설정
        clientRef.current.onSuccess(() => {
          console.log('클라이언트 연결 성공');
          setIsConnecting(false);
        }).onFailure((err) => {
          console.error('클라이언트 연결 실패:', err);
          setError(`연결 실패: ${err.message}`);
          setIsConnecting(false);
        });
      }
      
      setIsInitialized(true);
    } catch (err) {
      console.error('SDK 초기화 오류:', err);
      setError(err instanceof Error ? err.message : '알 수 없는 오류');
      setIsConnecting(false);
    }
  }, [mode, audioContext, audioSource, addConnectionLog]);

  // 클라이언트에서 호스트에 연결하는 함수
  const connectToHost = useCallback(async (hostName: string, phoneNumber: string = '+12345678901', cb: () => void) => {
    if (!clientRef.current) {
      setError('클라이언트가 초기화되지 않았습니다.');
      return;
    }

    try {
      setIsConnecting(true);
      setError(null);
      setConnectionLogs([]); // 연결 시작 시 로그 초기화
      
      addConnectionLog(`호스트 ${hostName}에 연결 시도...`, 'info');
      
      // 메시지 전송 인터셉트를 위한 메소드 모니터링
      if (transportRef.current) {
        const transport = transportRef.current;
        
        // 실제 메시지 전송을 모니터링하기 위해 메소드를 가로채기
        const originalSendMessage = transport.sendMessage;
        transport.sendMessage = async function(message: string) {
          addConnectionLog(`메시지 전송: ${message.substring(0, 50)}${message.length > 50 ? '...' : ''}`, 'request');
          return await originalSendMessage.call(this, message);
        };
      }
      
      // 호스트에 연결
      await clientRef.current.connect(hostName, phoneNumber)
      .onSuccess(() => {
        addConnectionLog('연결 성공', 'info');
        cb();
      })
      .onFailure((err) => {
        addConnectionLog(`연결 실패: ${err.message}`, 'error');
        setError(`연결 실패: ${err.message}`);
        setIsConnecting(false);
      });
    } catch (err) {
      console.error('호스트 연결 오류:', err);
      const errorMessage = err instanceof Error ? err.message : '알 수 없는 오류';
      addConnectionLog(`연결 오류: ${errorMessage}`, 'error');
      setError(errorMessage);
      setIsConnecting(false);
    }
  }, [addConnectionLog]);

  // Only setup cleanup function, no automatic initialization
  useEffect(() => {
    // Cleanup function
    return () => {
      if (audioSource) {
        audioSource.disconnect();
      }
      
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(track => track.stop());
      }
      
      if (audioContext && audioContext.state !== 'closed') {
        audioContext.close().catch(err => console.warn('AudioContext close error:', err));
      }
    };
  }, []);

  // Function to send a message
  const sendMessage = useCallback(async (text: string) => {
    try {
      setIsSending(true);
      
      if (mode === 'HOST' && hostRef.current) {
        // In host mode, we need to handle message sending differently
        // as there's no direct broadcast method
        
        // Since we don't have access to all clients directly, we'll use 
        // the transport layer to send the message (in a real app, this would
        // communicate with all connected clients, but for demo purposes
        // we're just adding it to the local message list)
        
        // We'll add this message to our own message list
        setMessages(prev => [
          ...prev,
          {
            id: uuidv4(),
            text,
            sender: 'me',
            timestamp: Date.now()
          }
        ]);
        
        // In a fully implemented app, you would handle actual message broadcasting here
        // For this demo, we're simulating broadcast by just adding it to our messages
      } else if (mode === 'CLIENT' && clientRef.current) {
        // Send message from client
        await clientRef.current.send(text);
        
        // Add to local messages
        setMessages(prev => [
          ...prev,
          {
            id: uuidv4(),
            text,
            sender: 'me',
            timestamp: Date.now()
          }
        ]);
      } else {
        throw new Error('SDK not initialized');
      }
    } catch (err) {
      console.error('Message sending error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsSending(false);
    }
  }, [mode]);

  // Switch between host and client mode
  const switchMode = useCallback((newMode: AppMode) => {
    if (newMode !== mode) {
      setMode(newMode);
      setIsInitialized(false);
    }
  }, [mode]);

  // 로그 초기화 함수
  const clearConnectionLogs = useCallback(() => {
    setConnectionLogs([]);
  }, []);

  // Return hook values and functions
  return {
    mode,
    switchMode,
    isInitialized,
    messages,
    sendMessage,
    isSending,
    error,
    initialize,
    connectToHost,
    isConnecting,
    connectionLogs,
    clearConnectionLogs,
  };
};
