/**
 * Types for secure Solana transactions through S3L (Secure Solana Link) communication
 */
import { Keypair } from "@solana/web3.js";
/**
 * I/O 인터페이스 - 메시지 통신에 사용되는 입출력 인터페이스
 */
export interface IMessageTransport {
    sendMessage(message: string): Promise<void>;
    onMessage(handler: (message: string) => void): void;
    connect: () => Promise<void>;
    disconnect: () => Promise<void>;
    startListening: () => Promise<boolean>;
    stopListening: () => void;
}
export interface HostConfig {
    cluster: string;
    phoneNumber: string;
    host: string;
    keyPair: Keypair;
}
export interface ClientConfig {
    cluster: string;
    keyPair: Keypair;
    testMode?: boolean;
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
export interface ISalClient {
    connect: (host: string, phoneNumber?: string) => ISalClient;
    send: (message: string) => Promise<void>;
    onSuccess: (callback: () => void) => ISalClient;
    onFailure: (callback: (error: Error) => void) => ISalClient;
    close: () => Promise<void>;
}
export interface ISalHost {
    register: (handlers: {
        messageHandler?: MessageHandler;
        txHandler?: TransactionHandler;
    }) => ISalHost;
    run: () => Promise<void>;
    stop: () => Promise<void>;
}
export type MessageHandler = (message: string, sender: string) => Promise<void> | void;
export type TransactionHandler = (transaction: any) => Promise<string> | string;
/**
 * 메시지 전송을 위한 인터페이스
 * 모든 메시지 전송 구현체는 이 인터페이스를 구현해야 함
 */
export interface MessageTransport {
    /**
     * 연결 시작
     * @returns 연결 성공 여부
     */
    connect(): Promise<boolean>;
    /**
     * 연결 종료
     */
    disconnect(): Promise<void>;
    /**
     * 메시지 전송
     * @param message 전송할 메시지
     */
    sendMessage(message: string): Promise<void>;
    /**
     * 메시지 수신 핸들러 등록
     * @param handler 메시지 수신 시 호출될 핸들러
     */
    onMessage(handler: (message: string) => void): void;
}
