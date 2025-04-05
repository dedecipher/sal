/**
 * Types for secure Solana transactions through S3L (Secure Solana Link) communication
 */

export enum Modality {
  VOICE = 'voice',
  TCP = 'tcp'
}

export interface HostConfig {
  cluster: string;       // Required: Solana cluster
  phoneNumber: string;   // Required: Phone number
  host: string;          // Required: Host address
  privateKey: string;    // Required: Solana private key
  modality?: Modality;   // Optional: Communication modality (default: VOICE)
}

export interface ClientConfig {
  cluster: string;       // Required: Solana cluster
  privateKey: string;    // Required: Solana private key
  modality?: Modality;   // Optional: Communication modality (default: VOICE)
}

export interface SalMessageHeaders {
  host?: string;         // Target host
  phone?: string;        // Phone number
  nonce: string;         // Nonce for security
  blockHeight?: number;  // Solana block height
  publicKey: string;     // Sender's public key
}

// JSON 기반 S3L 메시지 인터페이스
export interface SalRequest {
  sig: string;           // Signature of the body
  headers: SalMessageHeaders;
  body: any;             // Message body (can be string or object)
}

// JSON 기반 S3L 응답 메시지 인터페이스
export interface SalResponse {
  sig: string;           // Signature of the body
  status: 'ok' | 'error'; // Response status
  headers: SalMessageHeaders;
  body: any;             // Response body (can be string or object)
}

export type MessageHandler = (message: string, sender: string) => Promise<void> | void;
export type TransactionHandler = (transaction: any) => Promise<string> | string;
