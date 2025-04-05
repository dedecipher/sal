import {
  ClientConfig,
  SalMessageHeaders,
  SalRequest,
  SalResponse,
  SalMethod,
  ISalClient,
  IMessageTransport
} from '../types';
import { EventEmitter } from 'events';
import bs58 from 'bs58';
import {
  Keypair,
  Transaction,
  PublicKey,
  Connection,
  TransactionInstruction,
  SystemProgram,
  LAMPORTS_PER_SOL
} from '@solana/web3.js';
import * as nacl from 'tweetnacl';

/**
 * SalClient는 SalHost와 통신하는 클라이언트입니다.
 */
export class SalClient extends EventEmitter implements ISalClient {
  private cfg: ClientConfig;
  private isConnected: boolean = false;
  private currentHost: string | null = null;
  private messageTransport: IMessageTransport | null = null;
  private pendingRequests: Map<string, { resolve: (value: any) => void, reject: (reason?: any) => void }> = new Map();
  private keypair: Keypair;
  private connection: Connection;

  // 콜백 함수
  private onSuccessCallback: (() => void) | null = null;
  private onFailureCallback: ((error: Error) => void) | null = null;

  constructor(config: ClientConfig, messageTransport: IMessageTransport) {
    super();

    // 필수 설정 확인
    if (!config.cluster || !config.keyPair) {
      throw new Error('필수 설정 매개변수가 누락되었습니다.');
    }

    this.cfg = { ...config };

    // 키페어 생성
    this.keypair = config.keyPair;

    // Solana 연결 설정
    this.connection = new Connection(config.cluster);

    // 메시지 전송 인터페이스 설정
    this.messageTransport = messageTransport;

    // 메시지 핸들러 등록
    this.messageTransport.onMessage(this.handleIncomingMessage.bind(this));
  }

  /**
   * 호스트에 연결합니다.
   */
  public connect(host: string, phoneNumber?: string): SalClient {
    this.currentHost = host;

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

    if (this.messageTransport) {
      await this.messageTransport.disconnect();
    }

    this.isConnected = false;
    this.currentHost = null;
    this.emit('disconnected');
  }

  /**
   * 수신 메시지를 처리합니다.
   */
  private handleIncomingMessage(messageStr: string): void {
    try {
      // JSON 파싱 시도
      const response = JSON.parse(messageStr) as SalResponse;

      // 응답 처리
      this.handleResponse(response);
    } catch (error) {
      this.emit('error', new Error(`메시지 처리 오류: ${error}`));
    }
  }

  /**
   * 호스트와 연결을 수행합니다.
   */
  private async performConnection(host: string, phoneNumber?: string): Promise<void> {
    try {
      // 전송 계층 연결
      if (this.messageTransport) {
        await this.messageTransport.connect();
      }

      // GM 메시지 헤더 생성
      const headers: SalMessageHeaders = {
        host,
        nonce: this.generateNonce(),
        publicKey: this.keypair.publicKey.toString()
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
        throw new Error(`연결 거부됨: ${JSON.stringify(response.msg.body)}`);
      }
    } catch (error) {
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
    const headers: SalMessageHeaders = {
      host: this.currentHost as string,
      nonce: this.generateNonce(),
      publicKey: this.keypair.publicKey.toString()
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
    if (!this.messageTransport) {
      throw new Error('메시지 전송 인터페이스가 설정되지 않았습니다.');
    }

    // 요청 생성
    const msg = { headers, body };
    const request: SalRequest = {
      method,
      sig: this.sign(JSON.stringify(msg)),
      msg
    };

    // 요청을 JSON 문자열로 변환
    const requestJson = JSON.stringify(request);

    return new Promise((resolve, reject) => {
      // 타임아웃 설정
      const timeoutId = setTimeout(() => {
        this.pendingRequests.delete(headers.nonce);
        reject(new Error('응답 타임아웃'));
      }, 20000);
      
      // 요청 등록
      this.pendingRequests.set(headers.nonce, {
        resolve: (response: SalResponse) => {
          clearTimeout(timeoutId);
          resolve(response);
        },
        reject
      });

      // 메시지 전송
      this.messageTransport!.sendMessage(requestJson)
        .catch(error => {
          clearTimeout(timeoutId);
          this.pendingRequests.delete(headers.nonce);
          reject(error);
        });
    });
  }

  /**
   * 응답을 처리합니다.
   */
  private handleResponse(response: SalResponse): void {
    // 응답의 nonce 추출
    const nonce = response.msg.headers.nonce;

    // 보류 중인 요청 확인
    const pendingRequest = this.pendingRequests.get(nonce);
    if (pendingRequest) {
      // 응답 제공
      pendingRequest.resolve(response);
      this.pendingRequests.delete(nonce);
    }
  }

  /**
   * 랜덤 nonce를 생성합니다.
   */
  private generateNonce(): string {
    // 랜덤한 16바이트 버퍼 생성
    // const buffer = new Uint8Array(16);

    // // 각 바이트에 랜덤값 할당 (브라우저 dependent 코드 제거)
    // for (let i = 0; i < buffer.length; i++) {
    //   buffer[i] = Math.floor(Math.random() * 256);
    // }

    // return Array.from(buffer)
    //   .map(b => b.toString(16).padStart(2, '0'))
    //   .join('');
    return "1";
  }

  /**
   * 메시지에 서명합니다.
   */
  private sign(message: string): string {
    try {
      const messageUint8 = new TextEncoder().encode(message);
      // @solana/web3.js의 sign 함수 사용
      const signature = nacl.sign.detached(messageUint8, this.keypair.secretKey);
      return bs58.encode(signature);
    } catch (error) {
      return 'invalid-signature';
    }
  }

  /**
   * SOL 전송 트랜잭션을 생성하고 직렬화합니다.
   * @param amount SOL 전송 금액
   * @param memo 메모
   * @param recipient 수신자 주소
   * @returns 직렬화된 트랜잭션 문자열
   */
  public async createSolTransaction(
    amount: number,
    memo: string,
    recipient?: string
  ): Promise<string> {
    if (!this.isConnected) {
      throw new Error('호스트에 연결되지 않았습니다.');
    }

    try {
      if (!recipient) {
        if (!this.currentHost) {
          throw new Error('호스트가 지정되지 않았습니다.');
        }
        recipient = this.currentHost;
      }

      // SOL을 lamports로 변환 (1 SOL = 10^9 lamports)
      const lamports = amount * LAMPORTS_PER_SOL;

      // 발신자 및 수신자의 PublicKey
      const senderPubkey = this.keypair.publicKey;
      const recipientPubkey = new PublicKey(recipient);

      // SOL 전송 명령어 생성
      const transaction = new Transaction().add(
        // Add memo instruction first - this will be signed by the host
        new TransactionInstruction({
          keys: [{ pubkey: new PublicKey(recipient), isSigner: true, isWritable: true }],
          data: Buffer.from(memo, "utf-8"), // Memo message
          programId: new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"), // Memo program
        }),
        // Add transfer instruction - this will be signed by the client
        SystemProgram.transfer({
          fromPubkey: senderPubkey,
          toPubkey: recipientPubkey,
          lamports: lamports
        })
      );

      // 최근 블록해시 가져오기
      const { blockhash } = await this.connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = senderPubkey;

      // 트랜잭션 직렬화
      const serializedTransaction = bs58.encode(transaction.serialize());

      return serializedTransaction;
    } catch (error) {
      throw new Error(`SOL 트랜잭션 생성 오류: ${error}`);
    }
  }

  /**
   * 트랜잭션을 호스트로 전송합니다.
   */
  public async sendTransaction(serializedTransaction: string): Promise<string> {
    if (!this.isConnected || !this.currentHost) {
      throw new Error('호스트에 연결되지 않았습니다.');
    }

    const headers: SalMessageHeaders = {
      host: this.currentHost,
      nonce: this.generateNonce(),
      publicKey: this.keypair.publicKey.toString()
    };

    // 트랜잭션 전송 - 호스트가 메모 명령어에 서명하고 처리합니다
    const response = await this.sendRequest(SalMethod.TX, headers, serializedTransaction);

    if (response.status === 'ok' && response.msg.body.signature) {
      return response.msg.body.signature;
    } else {
      throw new Error(`트랜잭션 전송 실패: ${JSON.stringify(response.msg.body)}`);
    }
  }
}