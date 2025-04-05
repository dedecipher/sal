import { IMessageTransport } from '../types';
import { EventEmitter } from 'events';
/**
 * MockMessageTransport 클래스 - 메시지 전송을 모킹하고 요청/응답을 로깅합니다.
 */
export declare class MockMessageTransport extends EventEmitter implements IMessageTransport {
    private isListening;
    private messageHandler;
    private peerTransport;
    private name;
    constructor(name: string);
    connectToPeer(peer: MockMessageTransport): void;
    sendMessage(message: string): Promise<void>;
    onMessage(handler: (message: string) => void): void;
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    startListening(): Promise<boolean>;
    stopListening(): void;
}
