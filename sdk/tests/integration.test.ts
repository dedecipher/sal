import { SalClient } from '../src/sal/client';
import { SalHost } from '../src/sal/host';
import { ClientConfig, HostConfig, IMessageTransport, MessageHandler, TransactionHandler, SalMethod } from '../src/types';
import { Keypair } from '@solana/web3.js';
import { EventEmitter } from 'events';
import { MockMessageTransport } from '../src/sal/utils';

// Jest 타입 선언 (또는 테스트 프레임워크에 맞게 수정)
declare const describe: any;
declare const beforeEach: any;
declare const it: any;
declare const expect: any;

// 테스트 코드
describe('SAL Client & Host with Mock Transport', () => {
  // 테스트용 키페어 생성
  const hostKeypair = Keypair.generate();
  const clientKeypair = Keypair.generate();
  
  // 메시지 트랜스포트 인스턴스 생성
  let hostTransport: MockMessageTransport;
  let clientTransport: MockMessageTransport;
  
  // 호스트 및 클라이언트 인스턴스
  let host: SalHost;
  let client: SalClient;
  
  // 테스트 메시지 및 응답
  let testMessages: string[] = [];
  let receivedMessages: string[] = [];
  
  // 트랜잭션 처리 결과 저장
  let lastTransactionResult: string = '';
  
  beforeEach(() => {
    // 메시지 트랜스포트 설정
    hostTransport = new MockMessageTransport('Host');
    clientTransport = new MockMessageTransport('Client');
    hostTransport.connectToPeer(clientTransport); // mocking
    
    // 호스트 구성
    const hostConfig: HostConfig = {
      cluster: 'testnet',
      phoneNumber: '123-456-7890',
      host: 'test-host',
      keyPair: hostKeypair
    };
    
    // 클라이언트 구성
    const clientConfig: ClientConfig = {
      cluster: 'testnet',
      keyPair: clientKeypair
    };
    
    // 호스트 및 클라이언트 인스턴스 생성
    host = new SalHost(hostConfig, hostTransport);
    client = new SalClient(clientConfig, clientTransport);
    
    // 테스트 데이터 초기화
    testMessages = ['안녕하세요!', '테스트 메시지입니다.', '마지막 메시지입니다.'];
    receivedMessages = [];
    lastTransactionResult = '';
    
    // 호스트의 메시지 핸들러 등록
    const messageHandler: MessageHandler = async (message: string, sender: string) => {
      console.log(`호스트가 메시지 수신: ${message} (발신자: ${sender})`);
      receivedMessages.push(message);
    };
    
    // 호스트의 트랜잭션 핸들러 등록
    const txHandler: TransactionHandler = async (transaction: any) => {
      console.log(`호스트가 트랜잭션 수신:`, transaction);
      // 트랜잭션 처리 시뮬레이션 - 실제로는 Solana 트랜잭션 실행
      const txResult = `tx-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      lastTransactionResult = txResult;
      return txResult;
    };
    
    host.register({ messageHandler, txHandler });
  });
  
  it('should establish connection and exchange messages', async () => {
    // 호스트 실행
    await host.run();
    
    // 클라이언트 연결
    let connected = false;
    client.onSuccess(() => {
      connected = true;
    });
    
    client.connect('test-host');
    
    // 연결 확인을 위한 지연
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(connected).toBe(true);
    
    // 메시지 전송
    for (const message of testMessages) {
      await client.send(message);
      // 메시지 전송 및 처리를 위한 지연
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    // 모든 메시지가 수신되었는지 확인
    expect(receivedMessages.length).toBe(testMessages.length);
    expect(receivedMessages).toEqual(testMessages);
    
    // 연결 종료
    await client.close();
    await host.stop();
  });
  
  it('should handle GM method correctly', async () => {
    // 호스트 실행
    await host.run();
    
    // 클라이언트 연결 이벤트 감지
    let hostConnectEvent = false;
    // EventEmitter 인터페이스 사용
    (host as unknown as EventEmitter).on('client_connected', () => {
      hostConnectEvent = true;
    });
    
    // 클라이언트 연결
    let clientConnected = false;
    client.onSuccess(() => {
      clientConnected = true;
    });
    
    client.connect('test-host');
    
    // 연결 확인을 위한 지연
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // 양쪽 모두 연결이 성공했는지 확인
    expect(clientConnected).toBe(true);
    expect(hostConnectEvent).toBe(true);
    
    // 연결 종료
    await client.close();
    await host.stop();
  });
  
  it('should handle message method correctly', async () => {
    // 호스트 실행
    await host.run();
    
    // 클라이언트 연결
    client.connect('test-host');
    
    // 연결 확인을 위한 지연
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // 단일 메시지 테스트
    const testMessage = '단일 메시지 테스트';
    const response = await client.send(testMessage);
    
    // 응답 확인
    expect(response.status).toBe('ok');
    expect(response.code).toBe(200);
    expect(response.msg.body.received).toBe(true);
    
    // 메시지가 호스트에 도달했는지 확인
    expect(receivedMessages).toContain(testMessage);
    
    // 연결 종료
    await client.close();
    await host.stop();
  });
  
  it('should handle transaction method correctly', async () => {
    // 호스트 실행
    await host.run();
    
    // 클라이언트 연결
    client.connect('test-host');
    
    // 연결 확인을 위한 지연
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // 트랜잭션 데이터 생성
    const mockTransaction = {
      version: 0,
      blockhash: '5xfSDCUEbJNsQs1XVEpgpQv5fUXQFTsJUAefKEFh1FGu',
      recentBlockhash: 'GHtXQBsoZHVnNFa9YevAzFr17DJjgHXk3ycTKD5xD3Zi',
      feePayer: clientKeypair.publicKey.toString(),
      instructions: [
        {
          programId: '11111111111111111111111111111111',
          accounts: [
            { pubkey: clientKeypair.publicKey.toString(), isSigner: true, isWritable: true },
            { pubkey: hostKeypair.publicKey.toString(), isSigner: false, isWritable: true }
          ],
          data: 'AQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADwPg=='
        }
      ]
    };
    
    // SalClient의 sendRequest 메서드 접근을 위한 Helper
    const sendTransactionRequest = async (transaction: any) => {
      // @ts-ignore: typescript에서 private 메서드 접근을 위한 임시 방법
      const headers = {
        host: 'test-host',
        nonce: Math.random().toString(36).substring(2, 15),
        publicKey: clientKeypair.publicKey.toString()
      };
      
      // @ts-ignore: typescript에서 private 메서드 접근을 위한 임시 방법
      return (client as any).sendRequest(SalMethod.TX, headers, transaction);
    };
    
    // 트랜잭션 전송
    const response = await sendTransactionRequest(mockTransaction);
    
    // 응답 확인
    expect(response.status).toBe('ok');
    expect(response.code).toBe(200);
    expect(response.msg.body.signature).toBe(lastTransactionResult);
    
    // 연결 종료
    await client.close();
    await host.stop();
  });
}); 