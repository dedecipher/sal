import React, { useState } from 'react';
import { motion } from 'framer-motion';

type AppMode = 'HOST' | 'CLIENT';

interface NavbarProps {
  mode: AppMode;
  onModeChange: (mode: AppMode) => void;
  onConnectWallet: () => void;
  isWalletConnected: boolean;
  walletAddress?: string;
}

export default function Navbar({ 
  mode, 
  onModeChange, 
  onConnectWallet,
  isWalletConnected,
  walletAddress
}: NavbarProps) {
  return (
    <nav className="w-full bg-gradient-to-r from-indigo-900 to-purple-900 p-4 flex justify-between items-center">
      <div className="flex items-center space-x-2">
        <div className="rounded-lg p-1 flex padding-30">
          SAL DEMO
        </div>
      </div>
      
      <button
        onClick={onConnectWallet}
        className={`px-4 py-2 rounded-lg font-medium transition-all ${
          isWalletConnected
            ? 'bg-green-600 hover:bg-green-700 text-white'
            : 'bg-blue-600 hover:bg-blue-700 text-white'
        }`}
      >
        {isWalletConnected 
          ? `${walletAddress?.slice(0, 4)}...${walletAddress?.slice(-4)}` 
          : 'Connect Wallet'}
      </button>
    </nav>
  );
} 