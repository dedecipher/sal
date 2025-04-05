import { SalHost, SalClient } from '../src/sal';
import { Modality } from '../src/types';
import { describe, beforeAll, beforeEach, afterAll, afterEach, test, expect } from '@jest/globals';

describe('S3L Integration Tests', () => {
  let host: SalHost;
  let client: SalClient;
  
  beforeAll(async () => {
    // 호스트 설정
    const hostConfig = {
      cluster: 'https://api.devnet.solana.com',
      phoneNumber: '+1234567890',
      host: 'localhost',
      privateKey: 'some_private_key_placeholder',
      modality: Modality.TCP
    };

    // 호스트 생성 및 초기화
    host = new SalHost(hostConfig);
    
    // 메시지 핸들러 등록
    host.register({
      messageHandler: async (message, sender) => {
        console.log(`호스트가 메시지 수신: "${message}" (발신자: ${sender})`);
        return;
      }
    });

    await host.init();
    await host.run();
    
    // 테스트를 위해 호스트 객체를 클라이언트 클래스에 설정
    SalClient.setHost(host);
  });
  
  beforeEach(() => {
    // 클라이언트 설정
    const clientConfig = {
      cluster: 'https://api.devnet.solana.com',
      privateKey: 'another_private_key_placeholder',
      modality: Modality.TCP
    };

    // 클라이언트 생성
    client = new SalClient(clientConfig);
  });
  
  afterAll(async () => {
    // 호스트 종료
    await host.stop();
  });
  
  afterEach(async () => {
    // 클라이언트 연결 종료
    if (client) {
      await client.close();
    }
  });
  
  test('클라이언트가 호스트에 연결할 수 있어야 함', (done) => {
    client
      .onSuccess(() => {
        expect(true).toBe(true); // 연결 성공
        done();
      })
      .onFailure((error) => {
        done(error); // 연결 실패
      });
    
    client.connect('localhost');
  });
  
  test('클라이언트가 메시지를 전송할 수 있어야 함', (done) => {
    // 호스트 메시지 핸들러 재설정
    host.register({
      messageHandler: (message) => {
        console.log(`호스트가 메시지 수신: "${message}"`);
        expect(message).toBe('테스트 메시지');
        done(); // 메시지가 수신되면 테스트 완료
      }
    });
    
    client
      .onSuccess(async () => {
        await client.send('테스트 메시지');
      })
      .onFailure((error) => {
        done(error); // 연결 실패
      });
    
    client.connect('localhost');
  });
});