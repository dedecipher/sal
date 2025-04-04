import * as web3 from '@solana/web3.js';

/**
 * S3L 모달리티 타입 (통신 방식)
 */
export enum Modality {
  TCP = 'tcp',
  VOICE = 'voice'
}

/**
 * S3L 호스트 구성 타입
 */
export interface HostConfig {
  cluster: string;
  host: string;
  phoneNumber: string;
  privateKey: string;
  modality: Modality;
}

/**
 * S3L 클라이언트 구성 타입
 */
export interface ClientConfig {
  cluster: string;
  privateKey: string;
  modality: Modality;
}

/**
 * S3L 메시지 헤더 타입
 */
export interface S3lMessageHeaders {
  host?: string;
  phone?: string;
  nonce: string;
  blockHeight?: number;
  publicKey: string;
}

/**
 * S3L 핸들러 타입
 */
export interface S3lHandlers {
  messageHandler?: (message: any, sender: string) => Promise<void>;
  txHandler?: (transaction: web3.Transaction) => Promise<string>;
} 