'use client';

import { useState, useEffect, useRef } from 'react';
import { sendAudioMessage, audioMessageEmitter, createAnalyserNode, getAnalyserNode, initAudio } from '@/utils/audioUtils';
import { demoScripts } from '@/utils/demoScripts';
import { sendSol } from '@/utils/transactionUtils';
import SolanaWallet from './SolanaWallet';
// @ts-ignore
import AudioMotionAnalyzer from 'audiomotion-analyzer';
import TransactionPanel from './TransactionPanel';

interface AudioMessengerProps {
  mode: 'HOST' | 'CLIENT';
}

// walletInfo를 컴포넌트 외부로 이동
const WALLET_INFO = {
  CLIENT: {
    name: 'CLIENT' as const,
    publicKey: 'HMWPRbcS1KVEQvV5k223VtiybeHULAWNcMkH3Tq5f8MS'
  },
  HOST: {
    name: 'HOST' as const,
    publicKey: '6fJaqefDf8Fx8kdMJZRaCsNka8d7UwghgvGqsaYVxQ15'
  }
} as const;

export default function AudioMessenger({ mode }: AudioMessengerProps) {
  const [message, setMessage] = useState('');
  const [currentMessage, setCurrentMessage] = useState<string>('');
  const [receivedMessages, setReceivedMessages] = useState<string[]>([]);
  const [currentMessageIndex, setCurrentMessageIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const audioMotionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const [isTx, setIsTx] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const analyzerRef = useRef<any>(null);

  useEffect(() => {
    const handleRecordingMessage = async (text: string) => {
      console.log('Received message in component:', text);
      setCurrentMessage(text);
      
      // HOST 모드에서 특정 메시지가 나올 때 트랜잭션 실행
      if (mode === 'HOST' && 
          text === "Signed and broadcasted. Payment confirmed and verified on the blockchain. Your client's booking is now confirmed. Sending over the booking details now. Thank you!") {
        try {
          const clientPrivateKey = process.env.NEXT_PUBLIC_CLIENT_PRIVATE_KEY;
          console.log('Client private key:', clientPrivateKey ? 'exists' : 'missing');
          
          if (!clientPrivateKey) {
            throw new Error('Client private key not found in environment variables');
          }
          
          console.log('Starting transaction...');
          console.log('From: CLIENT wallet');
          console.log('To: HOST wallet -', WALLET_INFO.HOST.publicKey);
          console.log('Amount: 0.2 SOL');
          
          const signature = await sendSol(0.2, clientPrivateKey, WALLET_INFO.HOST.publicKey);
          console.log('Transaction sent successfully!');
          console.log('Signature:', signature);
          setIsTx(true);
        } catch (error) {
          console.error('Transaction failed with error:');
          console.error(error);
          if (error instanceof Error) {
            console.error('Error message:', error.message);
            console.error('Error stack:', error.stack);
          }
        }
      }

      if (text === "Yes, please proceed. Here's the transaction for 2.5 SOL. Can you sign this and broadcast it?") {
        setIsTx(true);
      }
      
      setReceivedMessages(prev => {
        console.log('Previous messages:', prev);
        const newMessages = [...prev, text];
        console.log('New messages:', newMessages);
        return newMessages;
      });
    };

    const handlePlaybackComplete = () => {
      setIsPlaying(false);
      const nextMessage = demoScripts.hotelBooking.messages.find((msg, idx) => 
        idx > currentMessageIndex && msg.sender === mode
      );
      
      if (nextMessage) {
        const nextIndex = demoScripts.hotelBooking.messages.indexOf(nextMessage);
        setTimeout(() => {
          setCurrentMessageIndex(nextIndex);
          setCurrentMessage(nextMessage.text);
          sendAudioMessage(nextMessage.text, audioContextRef.current!);
          setIsPlaying(true);
        }, nextMessage.delay || 1000);
      }
    };

    audioMessageEmitter.on('recordingMessage', handleRecordingMessage);
    audioMessageEmitter.on('playbackComplete', handlePlaybackComplete);

    return () => {
      audioMessageEmitter.off('recordingMessage', handleRecordingMessage);
      audioMessageEmitter.off('playbackComplete', handlePlaybackComplete);
    };
  }, [currentMessageIndex, mode]);

  // 오디오 시스템 초기화
  const initializeAudioSystem = async () => {
    try {
      console.log('Initializing audio system...');
      
      // 1. 오디오 컨텍스트 초기화
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
        await audioContextRef.current.resume();
        console.log('AudioContext created and resumed');
      }
      
      // 2. 오디오 시스템 초기화
      await initAudio(audioContextRef.current);
      console.log('Audio system initialized');
      
      // 3. 분석기 노드 생성
      createAnalyserNode(audioContextRef.current);
      const analyserNode = getAnalyserNode();
      if (!analyserNode) {
        throw new Error('Failed to create analyser node');
      }
      console.log('Analyser node created');

      // 4. 시각화 컨테이너 설정
      const container = document.getElementById('audioviz');
      if (!container) {
        throw new Error('Failed to find visualization container');
      }

      // 5. AudioMotionAnalyzer 초기화
      audioMotionRef.current = new AudioMotionAnalyzer(container, {
        source: analyserNode,
        height: 3000,
        width: 2400,
        mode: 6,
        fillAlpha: 0.7,
        lineWidth: 2,
        showScaleX: false,
        showScaleY: false,
        reflexRatio: 0.2,
        showBgColor: false,
        showPeaks: true,
        gradient: 'prism',
        smoothing: 0.7,
      });
      console.log('Audio visualization initialized');

      setIsInitialized(true);
      
      // 6. 첫 메시지 시작 (1초 후)
      setTimeout(async () => {
        const firstMessage = demoScripts.hotelBooking.messages.find(msg => msg.sender === mode);
        if (firstMessage) {
          console.log('Starting first message:', firstMessage.text);
          setCurrentMessageIndex(demoScripts.hotelBooking.messages.indexOf(firstMessage));
          setCurrentMessage(firstMessage.text);
          setIsPlaying(true);
          await sendAudioMessage(firstMessage.text, audioContextRef.current!);
        }
      }, 1000);

    } catch (error) {
      console.error('Error in audio system initialization:', error);
    }
  };

  const handleSendMessage = async () => {
    if (message.trim()) {
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }
      await sendAudioMessage(message, audioContextRef.current);
      setMessage('');
    }
  };

  const handleStartDemo = async () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }
    const firstClientMessage = demoScripts.hotelBooking.messages.find(msg => msg.sender === mode);
    if (firstClientMessage) {
      setCurrentMessageIndex(demoScripts.hotelBooking.messages.indexOf(firstClientMessage));
      setCurrentMessage(firstClientMessage.text);
      setIsPlaying(true);
      await sendAudioMessage(firstClientMessage.text, audioContextRef.current);
    }
  };

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden">
      {/* 지갑 정보를 상단 중앙에 배치 */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 z-[100] pt-4">
        <SolanaWallet {...WALLET_INFO[mode]} />
      </div>
      
      {!isInitialized && (
        <div className="absolute inset-0 flex items-center justify-center z-50 bg-black/80">
          <button
            onClick={initializeAudioSystem}
            className="px-8 py-4 bg-blue-500 hover:bg-blue-600 text-white text-xl font-medium rounded-lg transition-colors"
          >
            Start
          </button>
        </div>
      )}
      
      {/* 트랜잭션 패널 표시 조건 수정 */}
      {((mode === 'CLIENT' && currentMessage === "Yes, please proceed. Here's the transaction for 2.5 SOL. Can you sign this and broadcast it?") ||
        (mode === 'HOST' && currentMessage === "Signed and broadcasted. Payment confirmed and verified on the blockchain. Your client's booking is now confirmed. Sending over the booking details now. Thank you!")) && (
        <TransactionPanel 
          hostPublicKey={WALLET_INFO.HOST.publicKey}
          isTx={true}
          mode={mode}
        />
      )}
      
      {currentMessage && (
        <div className="absolute top-24 left-0 right-0 p-8 bg-black/50 backdrop-blur-sm border-b border-gray-700/30 z-40">
          <div className="text-white text-5xl font-medium text-center">
            {currentMessage}
          </div>
        </div>
      )}
      
      <div className="flex-1 flex relative">
        {/* 왼쪽 - 오디오 시각화 */}
        <div className="w-1/3 flex items-center justify-center z-30 translate-y-20 translate-x-32">
          <div id="audioviz" className="w-[2400px] h-[800px] flex items-center justify-center"></div>
        </div>

        {/* 오른쪽 - 메시지 및 녹음 컨트롤 */}
        <div className="w-2/3 flex items-center justify-center">
          <div className="w-full max-w-md p-4">
          </div>
        </div>
      </div>
    </div>
  );
} 