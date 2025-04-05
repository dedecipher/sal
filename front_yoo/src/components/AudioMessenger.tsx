'use client';

import { useState, useEffect, useRef } from 'react';
import { sendAudioMessage, audioMessageEmitter, createAnalyserNode, getAnalyserNode, initAudio } from '@/utils/audioUtils';
import { demoScripts } from '@/utils/demoScripts';
import SolanaWallet from './SolanaWallet';
// @ts-ignore
import AudioMotionAnalyzer from 'audiomotion-analyzer';

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
  const audioMotionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    const handleRecordingMessage = (text: string) => {
      console.log('Received message in component:', text);
      setCurrentMessage(text);
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

  // 오디오 시각화 초기화
  useEffect(() => {
    const initAudioVisualization = async () => {
      try {
        // 오디오 컨텍스트 초기화
        if (!audioContextRef.current) {
          audioContextRef.current = new AudioContext();
        }
        await initAudio(audioContextRef.current);
        
        // 분석기 노드 생성
        createAnalyserNode(audioContextRef.current);
        const analyserNode = getAnalyserNode();
        if (!analyserNode) {
          console.error('Failed to create analyser node');
          return;
        }

        const container = document.getElementById('audioviz');
        if (!container) {
          console.error('Failed to find visualization container');
          return;
        }

        // AudioMotionAnalyzer 초기화
        audioMotionRef.current = new AudioMotionAnalyzer(container, {
          source: analyserNode,
          height: 3000,
          width: 2400,
          mode: 6, // Oscilloscope 모드
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
      } catch (error) {
        console.error('Error initializing audio visualization:', error);
      }
    };

    initAudioVisualization();

    return () => {
      if (audioMotionRef.current) {
        try {
          audioMotionRef.current.destroy();
        } catch (error) {
          console.error('Error destroying AudioMotionAnalyzer:', error);
        }
        audioMotionRef.current = null;
      }
    };
  }, []);

  // 모드에 따라 자동으로 첫 번째 메시지 시작
  useEffect(() => {
    if (!isPlaying && currentMessageIndex === -1) {
      setTimeout(() => {
        const firstMessage = demoScripts.hotelBooking.messages.find(msg => msg.sender === mode);
        if (firstMessage) {
          setCurrentMessageIndex(demoScripts.hotelBooking.messages.indexOf(firstMessage));
          setCurrentMessage(firstMessage.text);
          setIsPlaying(true);
          sendAudioMessage(firstMessage.text, audioContextRef.current!);
        }
      }, 3000);
    }
  }, [mode, isPlaying, currentMessageIndex]);

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
    const firstClientMessage = demoScripts.hotelBooking.messages.find(msg => msg.sender === 'CLIENT');
    if (firstClientMessage) {
      setCurrentMessageIndex(demoScripts.hotelBooking.messages.indexOf(firstClientMessage));
      setCurrentMessage(firstClientMessage.text);
      setIsPlaying(true);
      await sendAudioMessage(firstClientMessage.text, audioContextRef.current);
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