import { ClientConfig, ISalClient, IMessageTransport } from '../types';
import { EventEmitter } from 'events';
/**
 * SalClient는 SalHost와 통신하는 클라이언트입니다.
 */
export declare class SalClient extends EventEmitter implements ISalClient {
    private cfg;
    private isConnected;
    private currentHost;
    private messageTransport;
    private pendingRequests;
    private keypair;
    private connection;
    private onSuccessCallback;
    private onFailureCallback;
    constructor(config: ClientConfig, messageTransport: IMessageTransport);
    /**
     * 호스트에 연결합니다.
     */
    connect(host: string, phoneNumber?: string): SalClient;
    /**
     * 성공 콜백을 설정합니다.
     */
    onSuccess(callback: () => void): SalClient;
    /**
     * 실패 콜백을 설정합니다.
     */
    onFailure(callback: (error: Error) => void): SalClient;
    /**
     * 연결된 호스트에 메시지를 전송합니다.
     */
    send(message: string): Promise<any>;
    /**
     * 연결을 종료합니다.
     */
    close(): Promise<void>;
    /**
     * 수신 메시지를 처리합니다.
     */
    private handleIncomingMessage;
    /**
     * 호스트와 연결을 수행합니다.
     */
    private performConnection;
    /**
     * 텍스트 메시지를 전송합니다.
     */
    private sendTextMessage;
    /**
     * 요청을 전송합니다.
     */
    private sendRequest;
    /**
     * 응답을 처리합니다.
     */
    private handleResponse;
    /**
     * 랜덤 nonce를 생성합니다.
     */
    private generateNonce;
    /**
     * 메시지에 서명합니다.
     */
    private sign;
    /**
     * SOL 전송 트랜잭션을 생성하고 직렬화합니다.
     * @param amount SOL 전송 금액
     * @param memo 메모
     * @param recipient 수신자 주소
     * @returns 직렬화된 트랜잭션 문자열
     */
    createSolTransaction(amount: number, memo: string, recipient?: string): Promise<string>;
    /**
     * 트랜잭션을 호스트로 전송합니다.
     */
    sendTransaction(serializedTransaction: string): Promise<string>;
}
