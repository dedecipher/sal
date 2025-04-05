import { HostConfig, MessageHandler, TransactionHandler, ISalHost, IMessageTransport } from '../types';
import { EventEmitter } from 'events';
/**
 * SalHost는 클라이언트와 통신하는 호스트를 구현합니다.
 */
export declare class SalHost extends EventEmitter implements ISalHost {
    private cfg;
    private messageHandler;
    private txHandler;
    private messageTransport;
    private clients;
    private isRunning;
    private seenNonces;
    private keypair;
    private connection;
    constructor(config: HostConfig, messageTransport: IMessageTransport);
    /**
     * 메시지 및 트랜잭션 핸들러를 등록합니다.
     */
    register(handlers: {
        messageHandler?: MessageHandler;
        txHandler?: TransactionHandler;
    }): SalHost;
    /**
     * 기본 트랜잭션 핸들러
     * 클라이언트가 보낸 Solana 트랜잭션을 직렬화하고, 서명을 추가한 후 네트워크에 브로드캐스트합니다.
     */
    private defaultTxHandler;
    /**
     * 서버를 시작하고 수신 연결을 기다립니다.
     */
    run(): Promise<void>;
    /**
     * 서버를 중지합니다.
     */
    stop(): Promise<void>;
    /**
     * 메시지를 처리합니다.
     */
    private handleIncomingMessage;
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
