import { SalClient } from '../src/sal/client';
import { SalHost } from '../src/sal/host';
import { ClientConfig, HostConfig, IMessageTransport, MessageHandler } from '../src/types';
import { Keypair } from '@solana/web3.js';
import { EventEmitter } from 'events';

/**
 * 스트림 기반 메시지 전송 인터페이스를 모킹합니다.
 * 이것은 메시지를 직접 전달하는 간단한 구현입니다.
 */
export class MockMessageTransport extends EventEmitter implements IMessageTransport {
    private isListening: boolean = false;
    private messageHandler: ((message: string) => void) | null = null;
    private peerTransport: MockMessageTransport | null = null;
    private name: string;
  
    constructor(name: string) {
      super();
      this.name = name;
    }
  
    // 다른 MockMessageTransport 인스턴스와 연결합니다
    public connectToPeer(peer: MockMessageTransport): void {
      this.peerTransport = peer;
      peer.peerTransport = this;
    }
  
    // 메시지 전송 (피어에게 직접 전달)
    public async sendMessage(message: string): Promise<void> {
      console.log(`[${this.name}] 메시지 전송: ${message.substring(0, 50)}...`);
      
      if (!this.peerTransport) {
        throw new Error('피어가 연결되지 않았습니다.');
      }
  
      // 잠시 지연 후 피어에게 메시지 전달 (비동기 시뮬레이션)
      setTimeout(() => {
        if (this.peerTransport && this.peerTransport.messageHandler) {
          this.peerTransport.messageHandler(message);
        }
      }, 10);
      
      return Promise.resolve();
    }
  
    // 메시지 수신 핸들러 등록
    public onMessage(handler: (message: string) => void): void {
      this.messageHandler = handler;
    }
  
    // 클라이언트용 연결 메서드
    public async connect(): Promise<void> {
      console.log(`[${this.name}] 연결 중...`);
      return Promise.resolve();
    }
  
    // 클라이언트용 연결 해제 메서드
    public async disconnect(): Promise<void> {
      console.log(`[${this.name}] 연결 해제 중...`);
      return Promise.resolve();
    }
  
    // 호스트용 수신 시작 메서드
    public async startListening(): Promise<boolean> {
      console.log(`[${this.name}] 수신 시작...`);
      this.isListening = true;
      return true;
    }
  
    // 호스트용 수신 중지 메서드
    public stopListening(): void {
      console.log(`[${this.name}] 수신 중지...`);
      this.isListening = false;
    }
  }