import { HostConfig, MessageHandler, TransactionHandler } from '../types';
import { EventEmitter } from 'events';
/**
 * SalHost는 음성 기반 통신을 통해 클라이언트와 통신하는 호스트를 구현합니다.
 */
export declare class SalHost extends EventEmitter {
    private cfg;
    private messageHandler;
    private txHandler;
    private audioCodec;
    private clients;
    private isRunning;
    private seenNonces;
    private keypair;
    constructor(config: HostConfig);
    /**
     * 호스트를 초기화합니다.
     */
    init(): Promise<void>;
    /**
     * 메시지 및 트랜잭션 핸들러를 등록합니다.
     */
    register(handlers: {
        messageHandler?: MessageHandler;
        txHandler?: TransactionHandler;
    }): SalHost;
    /**
     * 서버를 시작하고 수신 연결을 기다립니다.
     */
    run(): Promise<void>;
    /**
     * 서버를 중지합니다.
     */
    stop(): Promise<void>;
    /**
     * 오디오 메시지를 처리합니다.
     */
    private handleAudioMessage;
    /**
     * 수신 요청을 처리합니다.
     */
    private processIncomingRequest;
    /**
     * GM(인사) 메시지를 처리합니다.
     */
    private handleGM;
    /**
     * 일반 메시지를 처리합니다.
     */
    private handleMessage;
    /**
     * 트랜잭션을 처리합니다.
     */
    private handleTransaction;
    /**
     * 클라이언트에 응답을 전송합니다.
     */
    private sendResponse;
    /**
     * 서명을 확인합니다.
     */
    private verifySignature;
    /**
     * 메시지에 서명합니다.
     */
    private sign;
}
