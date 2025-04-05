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
  const [connection, setConnection] = useState<Connection | null>(null);
  const [wallet, setWallet] = useState<Keypair | null>(null);

  // 지갑 초기화
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
        const newWallet = Keypair.fromSecretKey(secretKeyBytes);
        setWallet(newWallet);
        
        // Devnet 연결 설정
        const newConnection = new Connection('https://api.devnet.solana.com', 'confirmed');
        setConnection(newConnection);
        
        // 지갑 주소 설정
        setWalletAddress(newWallet.publicKey.toString());
      } catch (error) {
        console.error('Failed to initialize wallet:', error);
      }
    };

    initializeWallet();
  }, [name]);

  // 잔액 새로고침
  useEffect(() => {
    if (!connection || !wallet) return;

    const fetchBalance = async () => {
      try {
        const balance = await connection.getBalance(wallet.publicKey);
        setBalance(balance / LAMPORTS_PER_SOL);
      } catch (error) {
        console.error('Failed to fetch balance:', error);
      }
    };

    // 초기 잔액 조회
    fetchBalance();

    // 2초마다 잔액 새로고침
    const intervalId = setInterval(fetchBalance, 2000);

    // 컴포넌트가 언마운트되면 인터벌 정리
    return () => clearInterval(intervalId);
  }, [connection, wallet]);

  return (
    <div className="bg-[#13141F] rounded-xl border border-[#1C2030] shadow-lg overflow-hidden">
      <div className="px-6 py-3 flex items-center space-x-8">
        <div className="flex items-center space-x-2">
          <div className={`w-2.5 h-2.5 rounded-full ${name === 'HOST' ? 'bg-green-500' : 'bg-blue-500'}`}></div>
          <span className="text-[#C4C7CD] font-medium text-lg">{name}</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="text-[#6B7280] text-sm">Wallet:</div>
          <div className="text-[#C4C7CD] font-medium">
            {walletAddress ? `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}` : '연결 중...'}
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <div className="text-[#6B7280] text-sm">Balance:</div>
          <div className="text-[#C4C7CD] font-bold text-lg">
            {balance !== null ? `${balance.toFixed(2)} SOL` : 'Loading...'}
          </div>
        </div>
      </div>
    </div>
  );
} 