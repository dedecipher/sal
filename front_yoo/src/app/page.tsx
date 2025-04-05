'use client';

import { useState, useEffect } from 'react';
import AudioMessenger from '@/components/AudioMessenger';
import ModeSelector from '@/components/ModeSelector';

export default function Home() {
  const [currentMode, setCurrentMode] = useState<'HOST' | 'CLIENT' | null>(null);
  const [sdkReady, setSdkReady] = useState(false);
  const [loading, setLoading] = useState(true);

  const handleModeChange = (mode: 'HOST' | 'CLIENT') => {
    setCurrentMode(mode);
  };

  // SDK 로드 확인
  useEffect(() => {
    const checkSdk = async () => {
      setLoading(true);
      try {
        // sal-sdk가 패키지로 제대로 설치되었는지 확인
        const mod = await import('sal-sdk');
        if (mod && mod.SalHost && mod.AudioMessageTransport) {
          setSdkReady(true);
        } else {
          console.error('SDK는 있지만 필요한 컴포넌트가 없습니다');
          setSdkReady(false);
        }
      } catch (error) {
        console.error('SDK 로드 실패:', error);
        setSdkReady(false);
      } finally {
        setLoading(false);
      }
    };

    checkSdk();
  }, []);

  if (loading) {
    return (
      <main className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-2xl">SDK 확인 중...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black">
      <div className="container mx-auto py-8">
        <div className="flex justify-between items-center mb-8">
          <ModeSelector onModeChange={handleModeChange} />
        </div>
        
        {!sdkReady && (
          <div className="bg-red-900/30 border border-red-600 p-6 rounded-lg text-white">
            <h2 className="text-xl font-bold mb-3">SDK 로드 실패</h2>
            <p className="mb-2">
              sal-sdk 패키지가 제대로 설치되지 않았습니다. 다음 명령어로 설치하세요:
            </p>
            <pre className="bg-black/30 p-3 rounded font-mono text-sm whitespace-pre-wrap">
              cd sdk && yarn build:all
              cd ../front_yoo && yarn
            </pre>
          </div>
        )}
        
        {currentMode && sdkReady && <AudioMessenger mode={currentMode} />}
      </div>
    </main>
  );
} 