# S3L (Secure Solana Link) SDK

S3L은 Solana 블록체인을 활용하여 인증 및 결제 기능을 제공하는 안전한 메시징 프로토콜입니다.
이 프로토콜은 암호화 서명을 통한 안전한 메시징을 제공하여 메시지 신뢰성을 보장하고 Solana 트랜잭션 처리를 가능하게 합니다.

## 주요 기능

- 암호화 서명을 통한 안전한 메시징
- Solana 키페어를 통한 인증
- 안전한 채널을 통한 트랜잭션 처리
- 다양한 통신 모달리티 지원 (TCP, Voice)
- 연결 부트스트래핑 및 핸드셰이크
- 메시지 및 트랜잭션 처리

## 프로토콜 명세

S3L 메시지는 다음과 같은 특정 형식을 따릅니다:

```
[S3L]
[SIG]...[SIG]
Host: example.com
Phone: 1234567890
Nonce: abc123
BlockHeight: 12345
PublicKey: {base64-encoded-public-key}

[MSG]
... (Message body)
[MSG]
[S3L]
```

### 메시지 타입

1. **연결 부트스트래핑 (GM)**:
   - 연결 설정을 위한 초기 핸드셰이크 메시지
   - 응답은 연결을 확인하고 신원을 설정

2. **일반 메시지**:
   - 클라이언트와 호스트 간의 텍스트 메시지
   - `[MSG]` 태그로 둘러싸임

3. **트랜잭션 메시지**:
   - Solana 트랜잭션 페이로드
   - `[TX]` 태그로 둘러싸임
   - 서버는 트랜잭션 서명으로 응답

## 실제 Solana 트랜잭션 처리 구현

S3L SDK는 실제 Solana 트랜잭션 흐름을 다음과 같이 구현합니다:

1. **클라이언트 (부분 서명)**:
   - 클라이언트는 Solana 트랜잭션을 생성합니다
   - 자신의 키페어로 트랜잭션에 부분 서명합니다
   - 부분 서명된 트랜잭션을 직렬화하여 S3L 프로토콜을 통해 호스트에 전송합니다

2. **호스트 (최종 서명 및 제출)**:
   - 호스트는 부분 서명된 트랜잭션을 역직렬화합니다
   - 트랜잭션의 유효성을 검증합니다
   - 자신의 키페어로 트랜잭션에 추가 서명합니다
   - 완전히 서명된 트랜잭션을 Solana 네트워크에 제출합니다
   - 트랜잭션 서명을 클라이언트에게 응답으로 전송합니다

이 구현을 통해 양쪽 당사자 모두 트랜잭션을 검증하고 승인할 수 있으며, 실제 블록체인 상에서 트랜잭션이 실행됩니다.

## 사용법

### 호스트 설정

```typescript
import { S3lHost, HostConfig, Modality } from 'gibberlink-sdk';

// 호스트 구성
const hostConfig: HostConfig = {
  cluster: "https://api.mainnet-beta.solana.com",
  host: "example.com",
  phoneNumber: "1234567890",
  privateKey: "your-solana-private-key",
  modality: Modality.TCP
};

// 호스트 생성 및 초기화
const server = new S3lHost(hostConfig);

// 메시지 핸들러 등록
server.register({
  // 메시지 핸들러
  messageHandler: async (message, sender) => {
    console.log(`Received message from ${sender}: ${message}`);
    // 메시지 처리
  },

  // 트랜잭션 핸들러
  txHandler: async (transaction) => {
    console.log('Processing transaction:', transaction);
    
    // 트랜잭션 검증
    // 호스트 키페어로 서명
    transaction.partialSign(hostKeypair);
    
    // Solana 네트워크에 제출
    const signature = await connection.sendRawTransaction(transaction.serialize());
    
    // 트랜잭션 서명 반환
    return signature;
  }
});

// 초기화 및 시작
await server.init();
await server.run();
```

### 클라이언트 설정

```typescript
import { S3lClient, ClientConfig, Modality } from 'gibberlink-sdk';
import { Transaction, SystemProgram } from '@solana/web3.js';

// 클라이언트 구성
const clientConfig: ClientConfig = {
  cluster: "https://api.mainnet-beta.solana.com",
  privateKey: "your-solana-private-key",
  modality: Modality.TCP
};

// 클라이언트 생성
const client = new S3lClient(clientConfig);

// 호스트에 연결
client
  .connect("example.com")
  .onSuccess(async () => {
    console.log("Connected successfully");
    
    // 트랜잭션 생성 및 전송 예제
    // SOL 전송 트랜잭션 생성
    const transaction = new Transaction();
    transaction.add(
      SystemProgram.transfer({
        fromPubkey: senderPublicKey,
        toPubkey: recipientPublicKey,
        lamports: 100000 // 0.0001 SOL
      })
    );
    
    // 트랜잭션 전송 (자동으로 부분 서명됨)
    const result = await client.send(transaction);
    console.log("Transaction result:", result);
  })
  .onFailure((error) => {
    console.error("Connection failed:", error);
  });

// 메시지 전송
const response = await client.send("Hello world!");
console.log("Message response:", response);

// 완료 후 연결 종료
await client.close();
```

## 테스트 실행

SDK에는 실제 트랜잭션 처리를 테스트하는 스크립트가 포함되어 있습니다:

```bash
# S3L 테스트 실행
yarn test:s3l
```

이 테스트는 다음을 수행합니다:
1. 클라이언트와 호스트 키페어 생성
2. Solana devnet에서 테스트 계정에 SOL 에어드롭
3. 호스트 서버 시작
4. 클라이언트 연결
5. 텍스트 메시지 전송
6. SOL 전송 트랜잭션 생성 및 처리
7. 트랜잭션 결과 및 잔액 변경 확인

## 라이센스

MIT 