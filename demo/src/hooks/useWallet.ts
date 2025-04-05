import { useState, useCallback, useEffect } from 'react';
import { Connection, PublicKey } from '@solana/web3.js';

// Wallet 상태 타입 정의
export interface WalletState {
  connected: boolean;
  publicKey: PublicKey | null;
  balance: number;
}

// 지갑 초기 상태
const initialWalletState: WalletState = {
  connected: false,
  publicKey: null,
  balance: 0,
};

export const useWallet = () => {
  // 지갑 상태 관리
  const [walletState, setWalletState] = useState<WalletState>(initialWalletState);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Phantom 지갑 가져오기
  const getProvider = useCallback(() => {
    if ('phantom' in window) {
      const provider = (window as any).phantom?.solana;
      if (provider?.isPhantom) {
        return provider;
      }
    }
    
    // 지갑이 설치되어 있지 않은 경우 링크 열기
    window.open('https://phantom.app/', '_blank');
    return null;
  }, []);

  // 지갑 연결
  const connect = useCallback(async () => {
    try {
      setIsConnecting(true);
      setError(null);
      
      const provider = getProvider();
      if (!provider) {
        throw new Error('Phantom wallet not found');
      }
      
      const { publicKey } = await provider.connect();
      
      // RPC 엔드포인트 설정 (devnet)
      const connection = new Connection('https://api.devnet.solana.com');
      
      // SOL 잔액 조회
      const balance = await connection.getBalance(publicKey);
      
      setWalletState({
        connected: true,
        publicKey,
        balance: balance / 1_000_000_000, // lamports를 SOL로 변환
      });
      
      setIsConnecting(false);
    } catch (err) {
      console.error('Failed to connect wallet:', err);
      setError('Failed to connect wallet: ' + (err instanceof Error ? err.message : String(err)));
      setIsConnecting(false);
    }
  }, [getProvider]);

  // 지갑 연결 해제
  const disconnect = useCallback(async () => {
    try {
      const provider = getProvider();
      if (provider) {
        await provider.disconnect();
        setWalletState(initialWalletState);
      }
    } catch (err) {
      console.error('Failed to disconnect wallet:', err);
      setError('Failed to disconnect wallet: ' + (err instanceof Error ? err.message : String(err)));
    }
  }, [getProvider]);

  // 지갑 상태 변경 감지
  useEffect(() => {
    const provider = getProvider();
    
    if (provider) {
      // 지갑 연결 이벤트 핸들러
      const handleConnect = () => {
        connect();
      };
      
      // 지갑 연결 해제 이벤트 핸들러
      const handleDisconnect = () => {
        setWalletState(initialWalletState);
      };
      
      // 계정 변경 이벤트 핸들러
      const handleAccountChange = (publicKey: PublicKey) => {
        if (publicKey) {
          setWalletState(prev => ({
            ...prev,
            publicKey,
          }));
        } else {
          setWalletState(initialWalletState);
        }
      };
      
      // 이벤트 리스너 등록
      provider.on('connect', handleConnect);
      provider.on('disconnect', handleDisconnect);
      provider.on('accountChanged', handleAccountChange);
      
      // 컴포넌트 언마운트 시 이벤트 리스너 제거
      return () => {
        provider.removeListener('connect', handleConnect);
        provider.removeListener('disconnect', handleDisconnect);
        provider.removeListener('accountChanged', handleAccountChange);
      };
    }
  }, [connect, getProvider]);

  return {
    walletState,
    isConnecting,
    error,
    connect,
    disconnect,
  };
}; 