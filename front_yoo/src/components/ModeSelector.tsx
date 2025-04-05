import { useState } from 'react';

type Mode = 'HOST' | 'CLIENT';

interface ModeSelectorProps {
  onModeChange: (mode: Mode) => void;
}

export default function ModeSelector({ onModeChange }: ModeSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedMode, setSelectedMode] = useState<Mode>('HOST');

  const handleModeSelect = (mode: Mode) => {
    setSelectedMode(mode);
    onModeChange(mode);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700"
      >
        <span>{selectedMode} Mode</span>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      
      {isOpen && (
        <div className="absolute mt-2 w-full bg-gray-800 rounded-lg shadow-lg">
          <button
            onClick={() => handleModeSelect('HOST')}
            className="w-full px-4 py-2 text-left text-white hover:bg-gray-700 rounded-t-lg"
          >
            HOST Mode
          </button>
          <button
            onClick={() => handleModeSelect('CLIENT')}
            className="w-full px-4 py-2 text-left text-white hover:bg-gray-700 rounded-b-lg"
          >
            CLIENT Mode
          </button>
        </div>
      )}
    </div>
  );
} 