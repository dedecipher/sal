'use client';

import { useState } from 'react';
import AudioMessenger from '@/components/AudioMessenger';
import ModeSelector from '@/components/ModeSelector';

export default function Home() {
  const [currentMode, setCurrentMode] = useState<'HOST' | 'CLIENT'>('CLIENT');

  const handleModeChange = (mode: 'HOST' | 'CLIENT') => {
    setCurrentMode(mode);
  };

  return (
    <main className="min-h-screen bg-black">
      <div className="container mx-auto py-8">
        <div className="flex justify-between items-center mb-8">
          <ModeSelector onModeChange={handleModeChange} currentMode={currentMode} />
        </div>
        <AudioMessenger mode={currentMode} />
      </div>
    </main>
  );
} 