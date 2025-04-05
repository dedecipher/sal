import {
  ClientConfig,
  Modality,
  SalMessageHeaders,
  SalRequest,
  SalResponse,
  SalMethod
} from '../types';
import { EventEmitter } from 'events';
import * as codec from './codec';
import * as crypto from 'crypto';

/**
 * SalClient는 음성 기반 통신을 통해 SalHost와 통신하는 클라이언트를 구현합니다.
 */
export class SalClient extends EventEmitter {
  private cfg: ClientConfig;
  private isConnected: boolean = false;
  private currentHost: string | null = null;
  private audioListener: { stop: () => void } | null = null;
  private pendingRequests: Map<string, { resolve: Function, reject: Function }> = new Map();

  // 콜백 함수
  private onSuccessCallback: (() => void) | null = null;
  private onFailureCallback: ((error: Error) => void) | null = null;

  constructor(config: ClientConfig) {
    super();
    
    // 필수 설정 확인
    if (!config.cluster || !config.privateKey) {
      throw new Error('필수 설정 매개변수가 누락되었습니다.');
    }
    
    this.cfg = {
      ...config,
      modality: Modality.VOICE // VOICE 모드만 지원
    };
  }
  
  /**
   * 호스트에 연결합니다.
   */
  public connect(host: string, phoneNumber?: string): SalClient {
    this.currentHost = host;
    
    // 오디오 수신 시작
    this.startAudioListener();
    
    // 연결 프로세스 시작
    this.performConnection(host, phoneNumber);
    
    return this;
  }
  
  /**
   * 성공 콜백을 설정합니다.
   */
  public onSuccess(callback: () => void): SalClient {
    this.onSuccessCallback = callback;
    return this;
  }
  
  /**
   * 실패 콜백을 설정합니다.
   */
  public onFailure(callback: (error: Error) => void): SalClient {
    this.onFailureCallback = callback;
    return this;
  }
  
  /**
   * 연결된 호스트에 메시지를 전송합니다.
   */
  public async send(message: string): Promise<any> {
    if (!this.isConnected) {
      throw new Error('호스트에 연결되지 않았습니다.');
    }
    
    if (!this.currentHost) {
      throw new Error('호스트가 지정되지 않았습니다.');
    }
    
    return this.sendTextMessage(message);
  }
  
  /**
   * 연결을 종료합니다.
   */
  public async close(): Promise<void> {
    if (!this.isConnected) {
      return;
    }
    
    // 오디오 수신 중지
    if (this.audioListener) {
      this.audioListener.stop();
      this.audioListener = null;
    }
    
    this.isConnected = false;
    this.currentHost = null;
    this.emit('disconnected');
    console.log('SAL 클라이언트 연결 종료');
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
        const response = JSON.parse(audioMessage) as SalResponse;
        
        // 응답 처리
        this.handleResponse(response);
      } catch (error) {
        console.error('오디오 메시지 처리 오류:', error);
      }
    });
  }
  
  /**
   * 호스트와 연결을 수행합니다.
   */
  private async performConnection(host: string, phoneNumber?: string): Promise<void> {
    try {
      console.log(`${host}에 연결 중...`);
      
      // GM 메시지 헤더 생성
      const headers: SalMessageHeaders = {
        host,
        nonce: this.generateNonce(),
        publicKey: "pubkey-placeholder" // 실제 구현에서는 실제 공개 키 사용
      };
      
      if (phoneNumber) {
        headers.phone = phoneNumber;
      }
      
      // GM 메시지 본문
      const body = "HELLO";
      
      // GM 메시지 전송
      const response = await this.sendRequest(SalMethod.GM, headers, body);
      
      // 응답 확인
      if (response.status === 'ok') {
        this.isConnected = true;
        this.emit('connected', host);
        
        if (this.onSuccessCallback) {
          this.onSuccessCallback();
        }
      } else {
        throw new Error(`연결 거부됨: ${response.msg.body}`);
      }
    } catch (error) {
      console.error('연결 실패:', error);
      
      if (this.onFailureCallback) {
        this.onFailureCallback(error instanceof Error ? error : new Error(String(error)));
      }
      
      this.emit('error', error);
    }
  }
  
  /**
   * 텍스트 메시지를 전송합니다.
   */
  private async sendTextMessage(message: string): Promise<any> {
    console.log(`${this.currentHost}에 텍스트 메시지 전송: ${message}`);
    
    const headers: SalMessageHeaders = {
      host: this.currentHost as string,
      nonce: this.generateNonce(),
      publicKey: "pubkey-placeholder" // 실제 구현에서는 실제 공개 키 사용
    };
    
    // 메시지 전송
    return this.sendRequest(SalMethod.MSG, headers, message);
  }
  
  /**
   * 요청을 전송합니다.
   */
  private async sendRequest(
    method: SalMethod,
    headers: SalMessageHeaders,
    body: any
  ): Promise<SalResponse> {
    // 요청 생성
    const msg = { headers, body };
    const request: SalRequest = {
      method,
      sig: this.sign(JSON.stringify(msg)),
      msg
    };
    
    // 요청을 JSON 문자열로 변환
    const requestJson = JSON.stringify(request);
    
    // 오디오로 전송
    await codec.playMessageAsAudio(requestJson);
    
    // 응답 대기
    return new Promise((resolve, reject) => {
      // 타임아웃 설정
      const timeoutId = setTimeout(() => {
        this.pendingRequests.delete(headers.nonce);
        reject(new Error('응답 타임아웃'));
      }, 10000);
      
      // 요청 등록
      this.pendingRequests.set(headers.nonce, {
        resolve: (response: SalResponse) => {
          clearTimeout(timeoutId);
          resolve(response);
        },
        reject
      });
    });
  }
  
  /**
   * 응답을 처리합니다.
   */
  private handleResponse(response: SalResponse): void {
    // 요청 헤더에서 nonce 추출
    const nonce = response.msg.headers.nonce;
    
    // 보류 중인 요청 확인
    const pendingRequest = this.pendingRequests.get(nonce);
    if (pendingRequest) {
      // 응답 확인
      pendingRequest.resolve(response);
      this.pendingRequests.delete(nonce);
    } else {
      console.warn('알 수 없는 응답 무시:', response);
    }
  }
  
  /**
   * 랜덤 nonce를 생성합니다.
   */
  private generateNonce(): string {
    return crypto.randomBytes(16).toString('hex');
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