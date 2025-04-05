import { SalClient } from '../sdk/src/sal/client';
import { SalHost } from '../sdk/src/sal/host';
import { Keypair, SystemProgram, PublicKey } from '@solana/web3.js';
import { SalMethod } from '../sdk/src/types';
import * as borsh from 'borsh';
// EventEmitter 추가
import { EventEmitter } from 'events';
// polyfill Buffer for browser
import { Buffer } from 'buffer';
// Make Buffer available globally
window.Buffer = Buffer;

// 메시지 트랜스포트 모킹 - 실제 애플리케이션에서는 WebSocket 또는 기타 통신 메커니즘을 사용
class DemoMessageTransport {
  constructor(name) {
    this.name = name;
    this.messageHandler = null;
    this.peerTransport = null;
    this.logDiv = document.getElementById(`${name.toLowerCase()}-log`);
  }

  connectToPeer(peer) {
    this.peerTransport = peer;
    peer.peerTransport = this;
    this.log(`피어와 연결됨: ${peer.name}`, 'info');
  }

  async sendMessage(message) {
    try {
      const parsedMessage = JSON.parse(message);
      if (parsedMessage.method) {
        // 요청인 경우
        this.log(`요청 전송: ${parsedMessage.method} 메서드, nonce=${parsedMessage.msg.headers.nonce}`, 'request');
      } else if (parsedMessage.status) {
        // 응답인 경우
        this.log(`응답 전송: ${parsedMessage.status}, code=${parsedMessage.code}, nonce=${parsedMessage.msg.headers.nonce}`, 'response');
      }
    } catch (error) {
      this.log(`메시지 전송: (파싱 불가능한 형식)`, 'error');
    }
    
    if (!this.peerTransport) {
      throw new Error('피어가 연결되지 않았습니다.');
    }

    // 잠시 지연 후 피어에게 메시지 전달 (비동기 시뮬레이션)
    setTimeout(() => {
      if (this.peerTransport && this.peerTransport.messageHandler) {
        this.peerTransport.messageHandler(message);
      }
    }, 500); // 데모에서 시간 지연을 더 크게 설정
    
    return Promise.resolve();
  }

  onMessage(handler) {
    // 원래 핸들러를 래핑하여 로깅 추가
    const wrappedHandler = (message) => {
      try {
        const parsedMessage = JSON.parse(message);
        if (parsedMessage.method) {
          // 요청인 경우
          this.log(`요청 수신: ${parsedMessage.method} 메서드, nonce=${parsedMessage.msg.headers.nonce}`, 'request');
        } else if (parsedMessage.status) {
          // 응답인 경우
          this.log(`응답 수신: ${parsedMessage.status}, code=${parsedMessage.code}, nonce=${parsedMessage.msg.headers.nonce}`, 'response');
        }
      } catch (error) {
        this.log(`메시지 수신: (파싱 불가능한 형식)`, 'error');
      }
      
      // 원래 핸들러 호출
      handler(message);
    };
    
    this.messageHandler = wrappedHandler;
  }

  async connect() {
    this.log('연결 중...', 'info');
    return Promise.resolve();
  }

  async disconnect() {
    this.log('연결 해제 중...', 'info');
    return Promise.resolve();
  }

  async startListening() {
    this.log('수신 시작...', 'info');
    return true;
  }

  stopListening() {
    this.log('수신 중지...', 'info');
  }
  
  // 로그 출력 함수
  log(message, type = 'info') {
    // 항상 콘솔에 로깅 (디버깅용)
    console.log(`[${this.name}] ${message}`);

    // DOM 요소에 로그 추가
    if (!this.logDiv) {
      console.error(`[${this.name}] 로그 패널을 찾을 수 없습니다. (${this.name.toLowerCase()}-log)`);
      return;
    }

    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    this.logDiv.appendChild(entry);
    this.logDiv.scrollTop = this.logDiv.scrollHeight;
  }
}

// 전역 변수
let hostTransport;
let clientTransport;
let host;
let client;
let isHostRunning = false;
let isClientConnected = false;

// DOM 요소
const hostStatusEl = document.querySelector('#host-status span');
const clientStatusEl = document.querySelector('#client-status span');
const startHostBtn = document.getElementById('start-host');
const stopHostBtn = document.getElementById('stop-host');
const connectClientBtn = document.getElementById('connect-client');
const disconnectClientBtn = document.getElementById('disconnect-client');
const sendMessageBtn = document.getElementById('send-message');
const sendTxBtn = document.getElementById('send-transaction');
const hostAddressInput = document.getElementById('host-address');
const messageInput = document.getElementById('message');

// 테스트용 키페어 생성
const hostKeypair = Keypair.generate();
const clientKeypair = Keypair.generate();

// 호스트 시작 이벤트 핸들러
startHostBtn.addEventListener('click', async () => {
  try {
    // 메시지 트랜스포트 설정
    hostTransport = new DemoMessageTransport('Host');
    
    // 호스트 구성
    const hostConfig = {
      cluster: 'testnet',
      phoneNumber: '123-456-7890',
      host: hostAddressInput.value || 'test-host',
      keyPair: hostKeypair
    };
    
    // 호스트 인스턴스 생성
    host = new SalHost(hostConfig, hostTransport);
    
    // 호스트의 메시지 핸들러 등록
    const messageHandler = async (message, sender) => {
      hostTransport.log(`메시지 처리: "${message}" (발신자: ${sender})`, 'info');
      return true;
    };
    
    // 호스트의 트랜잭션 핸들러 등록
    const txHandler = async (transaction) => {
      try {
        hostTransport.log(`트랜잭션 수신: ${JSON.stringify(transaction).substring(0, 100)}...`, 'info');
        
        // 트랜잭션 데이터 분석
        let transferAmount = "알 수 없음";
        if (transaction.instructions && transaction.instructions.length > 0) {
          const instruction = transaction.instructions[0];
          
          // System Program인지 확인
          if (instruction.programId === SystemProgram.programId.toString()) {
            try {
              // Base64로 인코딩된 데이터 디코딩
              const data = Buffer.from(instruction.data, 'base64');
              
              // System Program 명령어 타입 확인 (첫 번째 4바이트는 명령어 유형)
              const instructionType = data[0];
              
              // 2 = transfer 명령어
              if (instructionType === 2) {
                // lamports 값은 4바이트 오프셋 이후 8바이트
                // Solana의 transfer는 u64 (8바이트) lamports 값을 사용
                const lamportsBuffer = data.slice(4, 12);
                const lamportsView = new DataView(lamportsBuffer.buffer, lamportsBuffer.byteOffset, lamportsBuffer.byteLength);
                const lamports = Number(lamportsView.getBigUint64(0, true)); // true = little endian
                
                // Lamports를 SOL로 변환
                const sol = lamports / 1000000000;
                transferAmount = `${sol} SOL`;
                
                // 송금자와 수신자 계정 확인
                const sender = instruction.accounts[0]?.pubkey || "알 수 없음";
                const receiver = instruction.accounts[1]?.pubkey || "알 수 없음";
                
                hostTransport.log(`송금자: ${sender.substring(0, 8)}...`, 'info');
                hostTransport.log(`수신자: ${receiver.substring(0, 8)}...`, 'info');
                hostTransport.log(`금액: ${lamports} lamports (${sol} SOL)`, 'info');
                
                // 트랜잭션 승인 및 처리 시뮬레이션
                hostTransport.log(`트랜잭션 승인 중...`, 'info');
                
                // 호스트 서명 추가 시뮬레이션
                hostTransport.log(`호스트 키로 서명 중...`, 'info');
                
                // 실제 환경에서는 아래 코드와 같이 트랜잭션에 서명하고 직렬화한 후 전송
                // 1. 트랜잭션 객체 복원
                // const tx = Transaction.from(Buffer.from(transaction.data, 'base64'));
                // 2. 호스트 키로 서명
                // tx.sign(hostKeypair);
                // 3. 트랜잭션 전송
                // const connection = new Connection(clusterApiUrl(hostConfig.cluster));
                // const signature = await connection.sendRawTransaction(tx.serialize());
                
                // 서명 완료 시뮬레이션
                const simulatedSignature = `${hostKeypair.publicKey.toString().substring(0, 6)}_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
                
                hostTransport.log(`트랜잭션이 성공적으로 처리되었습니다.`, 'info');
                hostTransport.log(`트랜잭션 서명: ${simulatedSignature}`, 'info');
                
                return {
                  signature: simulatedSignature,
                  status: 'confirmed',
                  confirmations: 1,
                  slot: Date.now(),
                  fee: 5000,
                  amount: lamports,
                  sol: sol
                };
              } else {
                hostTransport.log(`지원하지 않는 System Program 명령어: ${instructionType}`, 'error');
                return { error: "지원하지 않는 명령어", code: "unsupported_instruction" };
              }
            } catch (err) {
              transferAmount = "디코딩 실패: " + err.message;
              hostTransport.log(`디코딩 오류: ${err.stack}`, 'error');
              return { error: "트랜잭션 디코딩 실패", code: "decode_error" };
            }
          } else {
            hostTransport.log(`지원하지 않는 프로그램 ID: ${instruction.programId}`, 'error');
            return { error: "지원하지 않는 프로그램", code: "unsupported_program" };
          }
        } else {
          hostTransport.log(`트랜잭션에 명령어가 없습니다.`, 'error');
          return { error: "명령어 없음", code: "no_instructions" };
        }
      } catch (error) {
        hostTransport.log(`트랜잭션 처리 오류: ${error.message}`, 'error');
        return { error: error.message, code: "processing_error" };
      }
    };
    
    host.register({ messageHandler, txHandler });
    
    // 이벤트 핸들러 등록 (호스트는 EventEmitter를 상속받음)
    host.emit = host.emit || EventEmitter.prototype.emit;
    host.on = host.on || EventEmitter.prototype.on;
    
    host.on('client_connected', (source) => {
      hostTransport.log(`클라이언트 연결됨: ${source}`, 'info');
    });
    
    host.on('error', (error) => {
      hostTransport.log(`오류: ${error.message}`, 'error');
    });
    
    // 호스트 실행
    await host.run();
    isHostRunning = true;
    
    // UI 업데이트
    hostStatusEl.textContent = '활성';
    hostStatusEl.className = 'connected';
    startHostBtn.disabled = true;
    stopHostBtn.disabled = false;
    
    hostTransport.log('호스트가 성공적으로 시작되었습니다.', 'info');
  } catch (error) {
    hostTransport.log(`호스트 시작 실패: ${error.message}`, 'error');
  }
});

// 호스트 중지 이벤트 핸들러
stopHostBtn.addEventListener('click', async () => {
  try {
    if (host) {
      await host.stop();
      isHostRunning = false;
      
      // UI 업데이트
      hostStatusEl.textContent = '비활성';
      hostStatusEl.className = 'disconnected';
      startHostBtn.disabled = false;
      stopHostBtn.disabled = true;
      
      hostTransport.log('호스트가 중지되었습니다.', 'info');
      
      // 클라이언트 연결 해제
      if (isClientConnected && client) {
        await client.close();
        isClientConnected = false;
        
        // UI 업데이트
        clientStatusEl.textContent = '연결 안됨';
        clientStatusEl.className = 'disconnected';
        connectClientBtn.disabled = false;
        disconnectClientBtn.disabled = true;
        sendMessageBtn.disabled = true;
        sendTxBtn.disabled = true;
        
        clientTransport.log('호스트 종료로 연결이 끊어졌습니다.', 'info');
      }
    }
  } catch (error) {
    hostTransport.log(`호스트 중지 실패: ${error.message}`, 'error');
  }
});

// 클라이언트 연결 이벤트 핸들러
connectClientBtn.addEventListener('click', async () => {
  try {
    // 메시지 트랜스포트 설정
    clientTransport = new DemoMessageTransport('Client');
    
    // 호스트 트랜스포트가 있으면 연결
    if (hostTransport) {
      clientTransport.connectToPeer(hostTransport);
      hostTransport.connectToPeer(clientTransport);
    } else {
      throw new Error('호스트가 실행 중이 아닙니다.');
    }
    
    // 클라이언트 구성
    const clientConfig = {
      cluster: 'testnet',
      keyPair: clientKeypair
    };
    
    // 클라이언트 인스턴스 생성
    client = new SalClient(clientConfig, clientTransport);
    
    // 이벤트 핸들러 등록 (클라이언트는 EventEmitter를 상속받음)
    client.emit = client.emit || EventEmitter.prototype.emit;
    client.on = client.on || EventEmitter.prototype.on;
    
    // 이벤트 핸들러 등록
    client.on('connected', (host) => {
      clientTransport.log(`호스트에 연결됨: ${host}`, 'info');
      isClientConnected = true;
      
      // UI 업데이트
      clientStatusEl.textContent = '연결됨';
      clientStatusEl.className = 'connected';
      connectClientBtn.disabled = true;
      disconnectClientBtn.disabled = false;
      sendMessageBtn.disabled = false;
      sendTxBtn.disabled = false;
    });
    
    client.on('disconnected', () => {
      clientTransport.log('호스트와 연결이 끊어졌습니다.', 'info');
      isClientConnected = false;
      
      // UI 업데이트
      clientStatusEl.textContent = '연결 안됨';
      clientStatusEl.className = 'disconnected';
      connectClientBtn.disabled = false;
      disconnectClientBtn.disabled = true;
      sendMessageBtn.disabled = true;
      sendTxBtn.disabled = true;
    });
    
    client.on('error', (error) => {
      clientTransport.log(`오류: ${error.message}`, 'error');
    });
    
    // 호스트에 연결
    client.onSuccess(() => {
      clientTransport.log('호스트에 성공적으로 연결되었습니다.', 'info');
    }).onFailure((error) => {
      clientTransport.log(`연결 실패: ${error.message}`, 'error');
    });
    
    const hostAddress = hostAddressInput.value || 'test-host';
    client.connect(hostAddress);
    
    clientTransport.log(`${hostAddress}에 연결 중...`, 'info');
    
  } catch (error) {
    if (clientTransport) {
      clientTransport.log(`연결 실패: ${error.message}`, 'error');
    } else {
      console.error(`연결 실패: ${error.message}`);
    }
  }
});

// 클라이언트 연결 해제 이벤트 핸들러
disconnectClientBtn.addEventListener('click', async () => {
  try {
    if (client) {
      await client.close();
      isClientConnected = false;
      
      // UI 업데이트
      clientStatusEl.textContent = '연결 안됨';
      clientStatusEl.className = 'disconnected';
      connectClientBtn.disabled = false;
      disconnectClientBtn.disabled = true;
      sendMessageBtn.disabled = true;
      sendTxBtn.disabled = true;
      
      clientTransport.log('호스트와 연결이 끊어졌습니다.', 'info');
    }
  } catch (error) {
    clientTransport.log(`연결 해제 실패: ${error.message}`, 'error');
  }
});

// 메시지 전송 이벤트 핸들러
sendMessageBtn.addEventListener('click', async () => {
  const message = messageInput.value.trim();
  if (message && client && isClientConnected) {
    try {
      clientTransport.log(`메시지 전송 중: "${message}"`, 'info');
      const response = await client.send(message);
      
      clientTransport.log(`메시지 전송 성공, 응답: ${JSON.stringify(response.msg.body)}`, 'info');
    } catch (error) {
      clientTransport.log(`메시지 전송 실패: ${error.message}`, 'error');
    }
  } else if (!message) {
    clientTransport.log('보낼 메시지를 입력하세요.', 'error');
  }
});

// 트랜잭션 전송 이벤트 핸들러
sendTxBtn.addEventListener('click', async () => {
  if (client && isClientConnected) {
    try {
      // 명확하게 0.01 SOL을 나타내는 10,000,000 lamports 값
      const lamports = 10000000; // 0.01 SOL
      
      // 클라이언트 전송 중임을 표시
      clientTransport.log(`===== SOL 전송 트랜잭션 생성 중 =====`, 'info');
      
      // Solana 라이브러리를 사용하여 전송 명령어 생성
      const fromPubkey = new PublicKey(clientKeypair.publicKey);
      const toPubkey = new PublicKey(hostKeypair.publicKey);
      
      clientTransport.log(`송금자: ${fromPubkey.toString().substring(0, 8)}...`, 'info');
      clientTransport.log(`수신자: ${toPubkey.toString().substring(0, 8)}...`, 'info');
      clientTransport.log(`금액: ${lamports} lamports (${lamports / 1000000000} SOL)`, 'info');
      
      // SystemProgram의 transfer 명령어 생성
      const transferInstruction = SystemProgram.transfer({
        fromPubkey,
        toPubkey,
        lamports
      });
      
      // 직렬화된 명령어 데이터 가져오기
      const data = transferInstruction.data;
      
      // Base64로 인코딩 (브라우저 호환)
      let base64Data;
      if (typeof Buffer !== 'undefined') {
        // Node.js 환경 또는 Buffer 폴리필 사용 가능한 경우
        base64Data = Buffer.from(data).toString('base64');
      } else {
        // 순수 브라우저 환경에서의 대안
        const uint8Array = new Uint8Array(data);
        const binaryString = Array.from(uint8Array)
          .map(byte => String.fromCharCode(byte))
          .join('');
        base64Data = btoa(binaryString);
      }
      
      // 실제 트랜잭션과 유사한 정보 구성
      const recentBlockhash = 'GHtXQBsoZHVnNFa9YevAzFr17DJjgHXk3ycTKD5xD3Zi';
      clientTransport.log(`블록해시: ${recentBlockhash}`, 'info');
      
      // 0.01 SOL 전송 트랜잭션 데이터 생성
      const mockTransaction = {
        version: 0,
        blockhash: recentBlockhash,
        recentBlockhash: recentBlockhash,
        feePayer: clientKeypair.publicKey.toString(),
        lastValidBlockHeight: 150000000, // 임의의 값
        instructions: [
          {
            programId: transferInstruction.programId.toString(), // System Program
            accounts: transferInstruction.keys.map(key => ({
              pubkey: key.pubkey.toString(),
              isSigner: key.isSigner,
              isWritable: key.isWritable
            })),
            data: base64Data // Solana 라이브러리로 생성한 데이터
          }
        ],
        // 클라이언트가 서명했음을 나타내는 정보
        signatures: [
          {
            pubkey: clientKeypair.publicKey.toString(),
            signature: `client_sig_${Date.now()}`
          }
        ]
      };
      
      clientTransport.log(`트랜잭션 생성 완료`, 'info');
      clientTransport.log(`호스트에 트랜잭션 전송 요청 중...`, 'info');
      
      // SalClient의 sendRequest 메서드 접근을 위한 Helper
      const sendTransactionRequest = async (transaction) => {
        // @ts-ignore: typescript에서 private 메서드 접근을 위한 임시 방법
        const headers = {
          host: hostAddressInput.value || 'test-host',
          nonce: Math.random().toString(36).substring(2, 15),
          publicKey: clientKeypair.publicKey.toString()
        };
        
        // @ts-ignore: typescript에서 private 메서드 접근을 위한 임시 방법
        return client.sendRequest(SalMethod.TX, headers, transaction);
      };
      
      // 트랜잭션 전송
      const response = await sendTransactionRequest(mockTransaction);
      
      // 응답 처리
      if (response.status === 'ok') {
        const result = response.msg.body;
        clientTransport.log(`트랜잭션 처리 결과: ${result}`, 'info');
        
        if (result.error) {
          clientTransport.log(`트랜잭션 처리 실패: ${result.error} (코드: ${result.code})`, 'error');
        } else {
          clientTransport.log(`===== 트랜잭션 처리 결과 =====`, 'info');
          clientTransport.log(`상태: ${result.status}`, 'info');        
          clientTransport.log(`서명: ${JSON.stringify(result.signature)}`, 'info');
          clientTransport.log(`===== 트랜잭션 완료 =====`, 'info');
        }
      } else {
        clientTransport.log(`요청 처리 실패: ${response.msg.body.error || '알 수 없는 오류'}`, 'error');
      }
    } catch (error) {
      clientTransport.log(`트랜잭션 전송 실패: ${error.message}`, 'error');
    }
  }
});