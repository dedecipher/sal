import {
  HostConfig,
  MessageHandler,
  TransactionHandler,
  Modality,
  SalRequest,
  SalResponse,
  SalMessageHeaders,
  SalMethod
} from '../types';
import { EventEmitter } from 'events';
import * as codec from './codec';
import * as crypto from 'crypto';

/**
 * SalHost는 음성 기반 통신을 통해 클라이언트와 통신하는 호스트를 구현합니다.
 */
export class SalHost extends EventEmitter {
  private cfg: HostConfig;
  private messageHandler: MessageHandler | null = null;
  private txHandler: TransactionHandler | null = null;
  private audioListener: { stop: () => void } | null = null;
  private clients: Map<string, { publicKey: string }> = new Map();
  private isRunning: boolean = false;
  private seenNonces: Set<string> = new Set(); // 재전송 공격 방지

  constructor(config: HostConfig) {
    super();
    
    // 필수 설정 확인
    if (!config.cluster || !config.phoneNumber || !config.host || !config.privateKey) {
      throw new Error('필수 설정 매개변수가 누락되었습니다.');
    }
    
    this.cfg = {
      ...config,
      modality: Modality.VOICE // VOICE 모드만 지원
    };
  }
  
  /**
   * 호스트를 초기화합니다.
   */
  public async init(): Promise<void> {
    try {
      console.log(`${this.cfg.host}에 대한 SAL 호스트 초기화`);
      
      // 초기화 이벤트 발생
      this.emit('initialized');
    } catch (error) {
      console.error('SAL 호스트 초기화 실패:', error);
      this.emit('error', error);
      throw error;
    }
  }
  
  /**
   * 메시지 및 트랜잭션 핸들러를 등록합니다.
   */
  public register(handlers: {
    messageHandler?: MessageHandler;
    txHandler?: TransactionHandler;
  }): SalHost {
    if (handlers.messageHandler) {
      this.messageHandler = handlers.messageHandler;
    }
    
    if (handlers.txHandler) {
      this.txHandler = handlers.txHandler;
    }
    
    return this;
  }
  
  /**
   * 서버를 시작하고 수신 연결을 수신합니다.
   */
  public async run(): Promise<void> {
    if (this.isRunning) {
      console.warn('SAL 호스트가 이미 실행 중입니다.');
      return;
    }
    
    try {
      // 오디오 수신 시작
      this.startAudioListener();
      
      this.isRunning = true;
      this.emit('running');
      console.log(`${this.cfg.host}에 대한 SAL 호스트가 실행 중입니다.`);
    } catch (error) {
      console.error('SAL 호스트 시작 실패:', error);
      this.emit('error', error);
      throw error;
    }
  }
  
  /**
   * 서버를 중지합니다.
   */
  public async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }
    
    // 오디오 수신 중지
    if (this.audioListener) {
      this.audioListener.stop();
      this.audioListener = null;
    }
    
    this.isRunning = false;
    this.emit('stopped');
    console.log('SAL 호스트 중지됨');
  }
  
  /**
   * 오디오 수신을 시작합니다.
   */
  private startAudioListener(): void {
    // 이미 수신 중이라면 중지
    if (this.audioListener) {
      this.audioListener.stop();
    }
    
    // 새로운 오디오 수신 시작
    this.audioListener = codec.startAudioListener(async (audioMessage) => {
      try {
        // JSON 메시지 파싱
        const request = JSON.parse(audioMessage) as SalRequest;
        
        // 요청 처리
        await this.processIncomingRequest(request, 'audio-source');
      } catch (error) {
        console.error('오디오 메시지 처리 오류:', error);
      }
    });
  }
  
  /**
   * 수신 요청을 처리합니다.
   */
  private async processIncomingRequest(request: SalRequest, source: string): Promise<void> {
    try {
      // 메시지 구조 확인
      if (!request.sig || !request.msg || !request.msg.headers || request.msg.body === undefined) {
        console.warn('잘못된 SAL 메시지 형식, 무시');
        return;
      }
      
      // nonce 확인 (재전송 공격 방지)
      const nonce = request.msg.headers.nonce;
      if (this.seenNonces.has(nonce)) {
        console.warn('이미 처리된 nonce, 무시');
        return;
      }
      this.seenNonces.add(nonce);
      
      // 서명 확인
      const isValid = this.verifySignature(
        request.msg.headers.publicKey,
        JSON.stringify(request.msg),
        request.sig
      );
      
      if (!isValid) {
        console.error('잘못된 메시지 서명, 거부');
        return;
      }
      
      // 메서드에 따라 처리
      switch (request.method) {
        case SalMethod.GM:
          await this.handleGM(request.msg.headers, request.msg.body, source);
          break;
        case SalMethod.MSG:
          await this.handleMessage(request.msg.headers, request.msg.body, source);
          break;
        case SalMethod.TX:
          await this.handleTransaction(request.msg.headers, request.msg.body, source);
          break;
        default:
          console.warn(`알 수 없는 메서드: ${request.method}`);
      }
    } catch (error) {
      console.error('수신 요청 처리 오류:', error);
    }
  }
  
  /**
   * GM(인사) 메시지를 처리합니다.
   */
  private async handleGM(headers: SalMessageHeaders, body: any, source: string): Promise<void> {
    console.log(`${source}에서 GM 메시지 수신`);
    
    // 클라이언트 정보 저장
    this.clients.set(source, {
      publicKey: headers.publicKey
    });
    
    // 클라이언트 연결 이벤트 발생
    this.emit('client_connected', source);
    
    // 확인 응답 전송
    await this.sendResponse(headers, "WELCOME", source, 'ok');
  }
  
  /**
   * 일반 메시지를 처리합니다.
   */
  private async handleMessage(headers: SalMessageHeaders, message: any, source: string): Promise<void> {
    if (this.messageHandler) {
      try {
        await this.messageHandler(
          typeof message === 'string' ? message : JSON.stringify(message),
          source
        );
        
        // 확인 응답 전송
        await this.sendResponse(headers, { received: true }, source, 'ok');
      } catch (error) {
        console.error('메시지 핸들러 오류:', error);
        await this.sendResponse(headers, { error: String(error) }, source, 'error');
      }
    } else {
      console.warn('메시지 핸들러가 등록되지 않음');
      await this.sendResponse(headers, { error: 'No message handler' }, source, 'error');
    }
  }
  
  /**
   * 트랜잭션을 처리합니다.
   */
  private async handleTransaction(headers: SalMessageHeaders, transaction: any, source: string): Promise<void> {
    if (this.txHandler) {
      try {
        const result = await this.txHandler(transaction);
        await this.sendResponse(headers, { signature: result }, source, 'ok');
      } catch (error) {
        console.error('트랜잭션 핸들러 오류:', error);
        await this.sendResponse(headers, { error: String(error) }, source, 'error');
      }
    } else {
      console.warn('트랜잭션 핸들러가 등록되지 않음');
      await this.sendResponse(headers, { error: 'No transaction handler' }, source, 'error');
    }
  }
  
  /**
   * 클라이언트에 응답을 전송합니다.
   */
  private async sendResponse(
    requestHeaders: SalMessageHeaders,
    body: any,
    destination: string,
    status: 'ok' | 'error' = 'ok'
  ): Promise<void> {
    const headers: SalMessageHeaders = {
      ...requestHeaders,
      host: this.cfg.host,
      nonce: requestHeaders.nonce, // 요청의 nonce 재사용
      publicKey: "pubkey-placeholder" // 실제 구현에서는 실제 공개 키 사용
    };
    
    const msg = { headers, body };
    
    const response: SalResponse = {
      status,
      code: status === 'ok' ? 200 : 400,
      sig: this.sign(JSON.stringify(msg)),
      msg
    };
    
    // 응답을 JSON 문자열로 변환
    const responseJson = JSON.stringify(response);
    
    // 오디오로 전송
    await codec.playMessageAsAudio(responseJson);
  }
  
  /**
   * 서명을 확인합니다.
   */
  private verifySignature(publicKey: string, message: string, signature: string): boolean {
    // 실제 구현에서는 공개 키로 서명 확인
    // 지금은 항상 true 반환 (테스트용)
    return true;
  }
  
  /**
   * 메시지에 서명합니다.
   */
  private sign(message: string): string {
    // 실제 구현에서는 개인 키로 메시지에 서명
    // 지금은 모의 서명 반환
    return `sig-${crypto.createHash('sha256').update(message).digest('hex').substring(0, 8)}`;
  }
}