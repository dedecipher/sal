/**
 * Types for secure Solana transactions through S3L (Secure Solana Link) communication
 */
import { Keypair } from "@solana/web3.js";
export declare enum Modality {
    VOICE = "voice",
    TCP = "tcp"
}
export interface HostConfig {
    cluster: string;
    phoneNumber: string;
    host: string;
    keyPair: Keypair;
    modality?: Modality;
}
export interface ClientConfig {
    cluster: string;
    keyPair: Keypair;
    modality?: Modality;
}
export interface SalMessageHeaders {
    host?: string;
    phone?: string;
    nonce: string;
    blockHeight?: number;
    publicKey: string;
}
export declare enum SalMethod {
    GM = "gm",
    MSG = "msg",
    TX = "tx"
}
export interface SalRequest {
    method: SalMethod;
    sig: string;
    msg: {
        headers: SalMessageHeaders;
        body: any;
    };
}
export interface SalResponse {
    status: 'ok' | 'error';
    code: number;
    sig: string;
    msg: {
        headers: SalMessageHeaders;
        body: any;
    };
}
export type MessageHandler = (message: string, sender: string) => Promise<void> | void;
export type TransactionHandler = (transaction: any) => Promise<string> | string;
