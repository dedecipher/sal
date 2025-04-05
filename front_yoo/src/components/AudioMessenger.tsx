'use client';

import { useState, useEffect, useRef } from 'react';
import { demoScripts } from '@/utils/demoScripts';
import SolanaWallet from './SolanaWallet';
// SDK와 로컬 헬퍼 함수 임포트
import { AudioMessageTransport, SalHost } from 'sal-sdk';
import { generateKeyPair } from '@/utils/sdk-helpers';

// SDK 타입 정의
declare global {
  interface Window {
    SAL: any;
  }
}

// AudioMotionAnalyzer 타입 정의
declare module 'audiomotion-analyzer' {
  export default class AudioMotionAnalyzer {
    constructor(container: HTMLElement, options: any);
    destroy(): void;
  }
}

interface AudioMessengerProps {
  mode: 'HOST' | 'CLIENT';
}

// 지갑 정보
const walletInfo = {
  CLIENT: {
    name: 'CLIENT',
    publicKey: 'HMWPRbcS1KVEQvV5k223VtiybeHULAWNcMkH3Tq5f8MS'
  },
  HOST: {
    name: 'HOST',
    publicKey: '6fJaqefDf8Fx8kdMJZRaCsNka8d7UwghgvGqsaYVxQ15'
  }
};

export default function AudioMessenger({ mode }: AudioMessengerProps) {
  const [message, setMessage] = useState('');
  const [currentMessage, setCurrentMessage] = useState('');
  const [receivedMessages, setReceivedMessages] = useState<string[]>([]);
  const [currentMessageIndex, setCurrentMessageIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  
  // SAL SDK 인스턴스
  const audioTransportRef = useRef<AudioMessageTransport | null>(null);
  const salInstanceRef = useRef<SalHost | null>(null);
  
  // 오디오 시각화 관련
  const audioMotionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserNodeRef = useRef<AnalyserNode | null>(null);

  // SDK 이벤트 핸들러 설정
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // SDK 초기화 함수
      const initSDK = async () => {
        // AudioContext 초기화
        try {
          if (!audioContextRef.current) {
            audioContextRef.current = new AudioContext();
          }
          
          // AudioMessageTransport 초기화
          audioTransportRef.current = new AudioMessageTransport({
            name: mode === 'HOST' ? 'HostTransport' : 'ClientTransport'
          });
          
          const initialized = await audioTransportRef.current.initialize();
          if (!initialized) {
            throw new Error('Failed to initialize AudioMessageTransport');
          }
          
          // 키페어 생성
          const keyPair = generateKeyPair();
          
          if (mode === 'HOST') {
            // SalHost 인스턴스 생성
            salInstanceRef.current = new SalHost({
              cluster: 'https://api.devnet.solana.com',
              phoneNumber: '+1234567890',
              host: 'audio-host',
              keyPair: keyPair
            }, audioTransportRef.current);
            
            // 호스트 이벤트 핸들러 등록
            salInstanceRef.current.on('running', () => {
              console.log('Host is running');
              setIsRunning(true);
            });
            
            salInstanceRef.current.on('stopped', () => {
              console.log('Host stopped');
              setIsRunning(false);
            });
            
            salInstanceRef.current.on('client_connected', (clientId: string) => {
              console.log('Client connected:', clientId);
              setCurrentMessage('Client connected: ' + clientId);
            });
            
            salInstanceRef.current.on('error', (error: Error) => {
              console.error('Host error:', error);
            });
            
            // 메시지 핸들러 등록
            salInstanceRef.current.register({
              messageHandler: async (messageText: string, source: string) => {
                console.log('Message received:', messageText, 'from:', source);
                setCurrentMessage(messageText);
                setReceivedMessages(prev => [...prev, messageText]);
                return;
              }
            });
            
            // 호스트 시작
            await salInstanceRef.current.run();
          } else {
            // 클라이언트 기능은 아직 구현하지 않음
            console.log('Client mode is not implemented yet');
          }
          
          setIsInitialized(true);
          console.log('SAL SDK initialized in', mode, 'mode');
          
          // 분석기 노드 설정
          if (audioContextRef.current) {
            analyserNodeRef.current = audioContextRef.current.createAnalyser();
            analyserNodeRef.current.fftSize = 2048;
            
            // 필요에 따라 분석기 노드 연결
            // 참고: 실제 SDK에 connectAnalyser 메서드가 없으면 이 부분은 구현하지 않음
          }
          
        } catch (error) {
          console.error('Failed to initialize SAL SDK:', error);
        }
      };
      
      initSDK();
      
      // 클린업 함수
      return () => {
        if (salInstanceRef.current) {
          salInstanceRef.current.stop();
        }
      };
    }
  }, [mode]);

  // 오디오 분석기 초기화 (시각화용)
  useEffect(() => {
    const initAudioVisualization = async () => {
      if (!analyserNodeRef.current) return;
      
      try {
        // 시각화 로직은 직접 CSS로 구현
        console.log('Audio visualization initialized');
        
        // 웨이브바 애니메이션 시작
        const animateWaves = () => {
          const waveBars = document.querySelectorAll('.wave-bar');
          waveBars.forEach((bar: Element) => {
            const height = Math.floor(Math.random() * 100) + 20;
            (bar as HTMLElement).style.height = `${height}px`;
          });
          
          requestAnimationFrame(animateWaves);
        };
        
        animateWaves();
      } catch (error) {
        console.error('Error initializing audio visualization:', error);
      }
    };
    
    // analyserNode가 설정된 후 시각화 초기화
    if (analyserNodeRef.current) {
      initAudioVisualization();
    }
    
    return () => {
      if (audioMotionRef.current) {
        try {
          if (typeof audioMotionRef.current.destroy === 'function') {
            audioMotionRef.current.destroy();
          }
        } catch (error) {
          console.error('Error destroying AudioMotionAnalyzer:', error);
        }
        audioMotionRef.current = null;
      }
    };
  }, [analyserNodeRef.current]);

  // 메시지 전송 함수
  const handleSendMessage = async () => {
    if (!message.trim() || !isInitialized) return;
    
    try {
      if (audioTransportRef.current) {
        await audioTransportRef.current.sendMessage(message);
        setCurrentMessage(message);
        setMessage('');
        console.log('Message sent:', message);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  // 데모 시작 함수
  const handleStartDemo = async () => {
    if (!isInitialized) return;
    
    try {
      const firstClientMessage = demoScripts.hotelBooking.messages.find(msg => msg.sender === mode);
      if (firstClientMessage && audioTransportRef.current) {
        setCurrentMessageIndex(demoScripts.hotelBooking.messages.indexOf(firstClientMessage));
        setCurrentMessage(firstClientMessage.text);
        setIsPlaying(true);
        await audioTransportRef.current.sendMessage(firstClientMessage.text);
      }
    } catch (error) {
      console.error('Failed to start demo:', error);
    }
  };

  return (
    <div className="flex flex-col h-screen">
      <SolanaWallet {...walletInfo[mode]} />
      
      {currentMessage && (
        <div className="w-full p-8 bg-black/50 backdrop-blur-sm border-b border-gray-700/30">
          <div className="text-white text-5xl font-medium text-center">
            {currentMessage}
          </div>
        </div>
      )}
      
      <div className="flex-1 flex">
        {/* 왼쪽 - 오디오 시각화 */}
        <div className="w-1/3 flex items-center justify-center">
          <div id="audioviz" className="w-full h-[800px] flex items-center justify-center">
            {/* 간단한 시각화 대체 */}
            <div className="wave-bars flex items-end h-[100px] gap-1">
              {Array(12).fill(0).map((_, i) => (
                <div 
                  key={i} 
                  className="wave-bar w-[8px] rounded-sm" 
                  style={{
                    height: `${Math.floor(Math.random() * 100) + 20}px`,
                    background: 'linear-gradient(to top, #2196F3, #00ff00)'
                  }}
                ></div>
              ))}
            </div>
          </div>
        </div>

        {/* 오른쪽 - 메시지 및 제어 */}
        <div className="w-2/3 flex items-center justify-center">
          <div className="w-full max-w-md p-4">
            <div className="flex flex-col gap-4">
              <button 
                onClick={handleStartDemo}
                className="p-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                disabled={!isInitialized}
              >
                {mode} 데모 시작
              </button>
              
              <div className="flex gap-2 mt-4">
                <input
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="메시지를 입력하세요"
                  className="flex-1 p-4 bg-gray-800 text-white border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500"
                  disabled={!isInitialized}
                />
                <button
                  onClick={handleSendMessage}
                  className="px-6 py-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  disabled={!isInitialized}
                >
                  전송
                </button>
              </div>
              
              <div className="text-sm text-gray-400 mt-2">
                상태: {isInitialized ? (isRunning ? '활성' : '초기화됨') : '초기화 중...'}
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <style jsx>{`
        @keyframes wave-animation {
          0% { height: 20px; }
          100% { height: 100px; }
        }
        .wave-bar {
          transition: height 0.2s ease;
          animation: wave-animation 0.5s ease-in-out infinite alternate;
        }
      `}</style>
    </div>
  );
} 