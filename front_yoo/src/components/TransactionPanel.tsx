import React from 'react';
import { FaCheckCircle, FaExternalLinkAlt } from 'react-icons/fa';

interface TransactionPanelProps {
  hostPublicKey: string;
  isTx: boolean;
  mode?: 'HOST' | 'CLIENT';
}

export default function TransactionPanel({ hostPublicKey, isTx, mode = 'CLIENT' }: TransactionPanelProps) {
  if (!isTx) return null;

  const isHost = mode === 'HOST';

  return (
    <div className="absolute right-4 top-1/2 -translate-y-1/2 w-[400px]">
      <div className="bg-[#13141F] rounded-2xl border border-[#1C2030] shadow-xl overflow-hidden">
        {/* View on Explorer 링크 */}
        <a
          href="https://explorer.solana.com/?cluster=devnet"
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full bg-[#0D0E14] px-6 py-3 text-[#C4C7CD] hover:text-white transition-colors flex items-center justify-center space-x-2 border-b border-[#1C2030]"
        >
          <span>View on Explorer</span>
          <FaExternalLinkAlt className="w-3 h-3" />
        </a>

        {/* From 섹션 */}
        <div className="p-6">
          <div className="text-[#C4C7CD] text-lg mb-4">From</div>
          <div className="bg-[#0D0E14] rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                <span className="text-white font-bold">C</span>
              </div>
              <span className="text-white text-lg font-medium">CLIENT</span>
            </div>
            <div className="text-[#6B7280]">~2.5 SOL</div>
          </div>
        </div>

        {/* 화살표 */}
        <div className="flex justify-center -mt-2 -mb-2 relative z-10">
          <div className="w-10 h-10 bg-[#1C2030] rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-[#C4C7CD]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </div>
        </div>

        {/* To 섹션 */}
        <div className="p-6">
          <div className="text-[#C4C7CD] text-lg mb-4">To</div>
          <div className="bg-[#0D0E14] rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                <span className="text-white font-bold">H</span>
              </div>
              <span className="text-white text-lg font-medium">HOST</span>
            </div>
            <div className="text-[#6B7280]">~2.5 SOL</div>
          </div>
        </div>

        {/* Memo & Signatures */}
        <div className="px-6 pb-6">
          <div className="bg-[#0D0E14] rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[#6B7280]">Memo</span>
              <span className="text-[#C4C7CD]">Seoulana Hotel, April 20-22</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#6B7280]">Client Signature</span>
              <FaCheckCircle className="text-green-400 text-xl" />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#6B7280]">Hotel Signature</span>
              {isHost ? (
                <FaCheckCircle className="text-green-400 text-xl" />
              ) : (
                <span className="text-[#6B7280]">Waiting...</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 