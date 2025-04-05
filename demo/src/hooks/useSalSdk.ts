import { useState, useCallback, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { AudioMessageTransport, SalClient, SalHost } from 'sal-sdk';
import { Message } from '../components/MessagePanel';
import { Keypair } from '@solana/web3.js';

// Define app mode type
export type AppMode = 'HOST' | 'CLIENT';

// AudioContext 타입 정의
interface AudioContextWindow extends Window {
  webkitAudioContext?: typeof AudioContext;
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
  
  // Audio context and stream
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [audioSource, setAudioSource] = useState<MediaStreamAudioSourceNode | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  
  // SDK instances
  const clientRef = useRef<SalClient | null>(null);
  const hostRef = useRef<SalHost | null>(null);
  const keypairRef = useRef<Keypair>(Keypair.generate());
  const transportRef = useRef<AudioMessageTransport | null>(null);

  // Initialize SDK based on mode
  const initialize = useCallback(async () => {
    try {
      setError(null);
      
      clientRef.current = null;
      hostRef.current = null;
      
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
        name: mode === 'HOST' ? 'HostTransport' : 'ClientTransport',
        sampleRate: newAudioContext.sampleRate
      });
      
      // Store transport reference
      transportRef.current = transport;
    
      // Initialize based on mode
      if (mode === 'HOST') {
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
        setIsInitialized(true);
      } else if (mode === 'CLIENT') {
        // 클라이언트 모드 - Solana 클러스터 및 키페어 설정
        const clientConfig = {
          cluster: 'https://api.devnet.solana.com',
          keyPair: keypairRef.current,
          testMode: true  // 데모용 테스트 모드 활성화
        };
        
        // SalClient 생성
        clientRef.current = new SalClient(clientConfig, transport);
        
        // 클라이언트 이벤트 핸들러 설정
        clientRef.current.onSuccess(() => {
          console.log('클라이언트 연결 성공');
          setIsInitialized(true);
          setIsConnecting(false);
        }).onFailure((err) => {
          console.error('클라이언트 연결 실패:', err);
          setError(`연결 실패: ${err.message}`);
          setIsConnecting(false);
        });

        // 클라이언트 모드에서는 자동으로 연결하지 않음
        // 사용자가 connectToHost 함수를 호출해야 함
      }
    } catch (err) {
      console.error('SDK 초기화 오류:', err);
      setError(err instanceof Error ? err.message : '알 수 없는 오류');
      setIsConnecting(false);
    }
  }, [mode]);

  // 클라이언트에서 호스트에 연결하는 함수
  const connectToHost = useCallback(async (hostName: string, phoneNumber: string = '+12345678901') => {
    if (mode !== 'CLIENT' || !clientRef.current) {
      setError('클라이언트 모드에서만 연결할 수 있습니다.');
      return;
    }

    try {
      setIsConnecting(true);
      setError(null);
      
      // 호스트에 연결
      await clientRef.current.connect(hostName, phoneNumber);
      
      // 여기서는 onSuccess 콜백에서 isInitialized를 설정하므로
      // 여기서는 설정하지 않음
    } catch (err) {
      console.error('호스트 연결 오류:', err);
      setError(err instanceof Error ? err.message : '알 수 없는 오류');
      setIsConnecting(false);
    }
  }, [mode]);

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
  };
};
