import { ClientConfig } from '../types';
import { EventEmitter } from 'events';
/**
 * SalClient는 음성 기반 통신을 통해 SalHost와 통신하는 클라이언트입니다.
 */
export declare class SalClient extends EventEmitter {
    private cfg;
    private isConnected;
    private currentHost;
    private audioCodec;
    private pendingRequests;
    private keypair;
    private onSuccessCallback;
    private onFailureCallback;
    constructor(config: ClientConfig);
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
     * 오디오 코덱을 초기화합니다.
     */
    private initAudioCodec;
    /**
     * 오디오 메시지를 처리합니다.
     */
    private handleAudioMessage;
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
}
