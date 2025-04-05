import { useEffect, useState } from 'react';
import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';

interface SolanaWalletProps {
  name: string;
  publicKey: string;
}

export default function SolanaWallet({ name, publicKey }: SolanaWalletProps) {
  const [balance, setBalance] = useState<number | null>(null);
  const [walletAddress, setWalletAddress] = useState<string>('');

  useEffect(() => {
    const initializeWallet = async () => {
      try {
        // 환경 변수에서 개인키 가져오기
        const secretKey = name === 'HOST' 
          ? process.env.NEXT_PUBLIC_HOST_PRIVATE_KEY 
          : process.env.NEXT_PUBLIC_CLIENT_PRIVATE_KEY;

        if (!secretKey) {
          throw new Error('Private key not found in environment variables');
        }

        // base58로 인코딩된 개인키를 Uint8Array로 변환
        const secretKeyBytes = bs58.decode(secretKey);
        const wallet = Keypair.fromSecretKey(secretKeyBytes);
        
        // Devnet 연결 설정
        const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
        
        // 지갑 주소 설정
        setWalletAddress(wallet.publicKey.toString());
        
        // 잔액 조회
        const balance = await connection.getBalance(wallet.publicKey);
        setBalance(balance / LAMPORTS_PER_SOL);
      } catch (error) {
        console.error('Failed to initialize wallet:', error);
      }
    };

    initializeWallet();
  }, [name]);

  return (
    <div className="absolute top-4 right-4 bg-black/50 backdrop-blur-sm p-4 rounded-lg border border-gray-700/30">
      <div className="text-white">
        <div className="font-medium mb-1">{name}</div>
        <div className="text-sm opacity-80 mb-2">
          {walletAddress.slice(0, 4)}...{walletAddress.slice(-4)}
        </div>
        <div className="text-sm">
          {balance !== null ? `${balance.toFixed(2)} DEVSOL` : 'Loading...'}
        </div>
      </div>
    </div>
  );
} 