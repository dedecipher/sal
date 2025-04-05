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
import { AudioMessageTransport } from '../sdk/src/sal/transport'; // SDK의 AudioMessageTransport 클래스 가져오기

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

// 페이지 로드 시 오디오 초기화
document.addEventListener('DOMContentLoaded', () => {
  console.log('오디오 메시지 트랜스포트 데모가 로드되었습니다.');
  console.log('마이크 및 오디오 권한이 필요합니다.');
  
  // 오디오 컨텍스트 초기화 시도 (사용자 상호작용 필요)
  const activateBtn = document.getElementById('activate-audio');
  if (activateBtn) {
    activateBtn.addEventListener('click', () => {
      // 임시 오디오 컨텍스트 생성 및 시작
      const tempContext = new (window.AudioContext || window.webkitAudioContext)();
      
      // 컨텍스트 상태 확인
      if (tempContext.state === 'suspended') {
        tempContext.resume().then(() => {
          document.getElementById('audio-status').textContent = 
            '오디오 상태: 활성화됨 (샘플 레이트: ' + tempContext.sampleRate + 'Hz)';
          activateBtn.textContent = '✅ 오디오가 활성화되었습니다';
          activateBtn.style.backgroundColor = '#28a745';
        });
      } else {
        document.getElementById('audio-status').textContent = 
          '오디오 상태: 이미 활성화됨 (샘플 레이트: ' + tempContext.sampleRate + 'Hz)';
        activateBtn.textContent = '✅ 오디오가 활성화되었습니다';
        activateBtn.style.backgroundColor = '#28a745';
      }
      
      // 마이크 접근 시도
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
          document.getElementById('mic-status').textContent = 
            '마이크 상태: 접근 권한 획득됨';
          
          // 스트림 트랙 정지 (권한 확인용으로만 사용)
          stream.getTracks().forEach(track => track.stop());
        })
        .catch(err => {
          document.getElementById('mic-status').textContent = 
            '마이크 상태: 접근 거부됨 - ' + err.message;
          console.error('마이크 접근 오류:', err);
        });
    });
  }
});

// 호스트 시작 이벤트 핸들러
startHostBtn.addEventListener('click', async () => {
  try {
    // SDK의 AudioMessageTransport 설정
    hostTransport = new AudioMessageTransport({
      name: 'Host',
      logElement: 'host-log'
    });
    
    // 호스트 구성
    const hostConfig = {
      cluster: 'testnet',
      phoneNumber: '123-456-7890',
      host: hostAddressInput.value || 'audio-host',
      keyPair: hostKeypair
    };
    
    // 호스트 인스턴스 생성
    host = new SalHost(hostConfig, hostTransport);
    
    // 호스트의 메시지 핸들러 등록
    const messageHandler = async (message, sender) => {
      console.log(`메시지 처리: "${message}" (발신자: ${sender})`);
      addLogEntry('host-log', `메시지 처리: "${message}" (발신자: ${sender})`, 'info');
      return true;
    };
    
    // 호스트의 트랜잭션 핸들러 등록
    const txHandler = async (transaction) => {
      try {
        console.log(`트랜잭션 수신: ${JSON.stringify(transaction).substring(0, 100)}...`);
        addLogEntry('host-log', `트랜잭션 수신: ${JSON.stringify(transaction).substring(0, 50)}...`, 'info');
        
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
                
                addLogEntry('host-log', `송금자: ${sender.substring(0, 8)}...`, 'info');
                addLogEntry('host-log', `수신자: ${receiver.substring(0, 8)}...`, 'info');
                addLogEntry('host-log', `금액: ${lamports} lamports (${sol} SOL)`, 'info');
                
                // 트랜잭션 승인 및 처리 시뮬레이션
                addLogEntry('host-log', `트랜잭션 승인 중...`, 'info');
                
                // 호스트 서명 추가 시뮬레이션
                addLogEntry('host-log', `호스트 키로 서명 중...`, 'info');
                
                // 서명 완료 시뮬레이션
                const simulatedSignature = `${hostKeypair.publicKey.toString().substring(0, 6)}_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
                
                addLogEntry('host-log', `트랜잭션이 성공적으로 처리되었습니다.`, 'info');
                addLogEntry('host-log', `트랜잭션 서명: ${simulatedSignature}`, 'info');
                
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
                addLogEntry('host-log', `지원하지 않는 System Program 명령어: ${instructionType}`, 'error');
                return { error: "지원하지 않는 명령어", code: "unsupported_instruction" };
              }
            } catch (err) {
              transferAmount = "디코딩 실패: " + err.message;
              addLogEntry('host-log', `디코딩 오류: ${err.message}`, 'error');
              return { error: "트랜잭션 디코딩 실패", code: "decode_error" };
            }
          } else {
            addLogEntry('host-log', `지원하지 않는 프로그램 ID: ${instruction.programId}`, 'error');
            return { error: "지원하지 않는 프로그램", code: "unsupported_program" };
          }
        } else {
          addLogEntry('host-log', `트랜잭션에 명령어가 없습니다.`, 'error');
          return { error: "명령어 없음", code: "no_instructions" };
        }
      } catch (error) {
        addLogEntry('host-log', `트랜잭션 처리 오류: ${error.message}`, 'error');
        return { error: error.message, code: "processing_error" };
      }
    };
    
    host.register({ messageHandler, txHandler });
    
    // 이벤트 핸들러 등록
    host.emit = host.emit || EventEmitter.prototype.emit;
    host.on = host.on || EventEmitter.prototype.on;
    
    host.on('client_connected', (source) => {
      addLogEntry('host-log', `클라이언트 연결됨: ${source}`, 'info');
    });
    
    host.on('error', (error) => {
      addLogEntry('host-log', `오류: ${error.message}`, 'error');
    });
    
    // 오디오 초기화 및 호스트 실행
    await hostTransport.initialize();
    await host.run();
    isHostRunning = true;
    
    // UI 업데이트
    hostStatusEl.textContent = '활성';
    hostStatusEl.className = 'connected';
    startHostBtn.disabled = true;
    stopHostBtn.disabled = false;
    
    addLogEntry('host-log', '호스트가 성공적으로 시작되었습니다. 수신 대기 중...', 'info');
  } catch (error) {
    console.error("호스트 시작 실패:", error);
    addLogEntry('host-log', `호스트 시작 실패: ${error.message}`, 'error');
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
      
      addLogEntry('host-log', '호스트가 중지되었습니다.', 'info');
      
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
        
        addLogEntry('client-log', '호스트 종료로 연결이 끊어졌습니다.', 'info');
      }
    }
  } catch (error) {
    addLogEntry('host-log', `호스트 중지 실패: ${error.message}`, 'error');
  }
});

// 클라이언트 연결 이벤트 핸들러
connectClientBtn.addEventListener('click', async () => {
  try {
    // SDK의 AudioMessageTransport 설정
    clientTransport = new AudioMessageTransport({
      name: 'Client',
      logElement: 'client-log'
    });
    
    // 클라이언트 구성
    const clientConfig = {
      cluster: 'testnet',
      keyPair: clientKeypair
    };
    
    // 클라이언트 인스턴스 생성
    client = new SalClient(clientConfig, clientTransport);
    
    // 오디오 초기화
    await clientTransport.initialize();
    
    // 이벤트 핸들러 등록
    client.emit = client.emit || EventEmitter.prototype.emit;
    client.on = client.on || EventEmitter.prototype.on;
    
    // 이벤트 핸들러 등록
    client.on('connected', (host) => {
      addLogEntry('client-log', `호스트에 연결됨: ${host}`, 'info');
      isClientConnected = true;
      
      // UI 업데이트
      clientStatusEl.textContent = '연결됨';
      clientStatusEl.className = 'connected';
      connectClientBtn.disabled = true;
      disconnectClientBtn.disabled = false;
      sendMessageBtn.disabled = false;
      sendTxBtn.disabled = false;
    });
    
    client.on('message', (message) => {
      addLogEntry('client-log', `호스트로부터 메시지 수신: ${message}`, 'info');
    });
    
    client.on('error', (error) => {
      addLogEntry('client-log', `오류: ${error.message}`, 'error');
    });
    
    // 호스트에 연결
    const hostAddress = hostAddressInput.value || 'audio-host';
    addLogEntry('client-log', `호스트 ${hostAddress}에 연결 중...`, 'info');
    await client.connect(hostAddress);
    
  } catch (error) {
    addLogEntry('client-log', `클라이언트 연결 실패: ${error.message}`, 'error');
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
      
      addLogEntry('client-log', '호스트와의 연결이 종료되었습니다.', 'info');
    }
  } catch (error) {
    addLogEntry('client-log', `연결 해제 실패: ${error.message}`, 'error');
  }
});

// 메시지 전송 이벤트 핸들러
sendMessageBtn.addEventListener('click', async () => {
  try {
    if (!client || !isClientConnected) {
      addLogEntry('client-log', '호스트에 연결되어 있지 않습니다. 먼저 연결하세요.', 'error');
      return;
    }
    
    const message = messageInput.value.trim();
    if (!message) {
      addLogEntry('client-log', '전송할 메시지를 입력하세요.', 'error');
      return;
    }
    
    addLogEntry('client-log', `메시지 전송 중: "${message}"`, 'request');
    
    // 메시지 전송
    const sendMessageRequest = async (message) => {
      try {
        // 메시지 타입 생성 (문자열)
        const messageRequest = {
          method: SalMethod.MSG,
          data: message
        };
        
        // 메시지 전송
        await client.send(JSON.stringify(messageRequest));
        
        addLogEntry('client-log', `메시지가 성공적으로 전송되었습니다.`, 'request');
        return true;
      } catch (error) {
        addLogEntry('client-log', `메시지 전송 실패: ${error.message}`, 'error');
        return false;
      }
    };
    
    await sendMessageRequest(message);
  } catch (error) {
    addLogEntry('client-log', `메시지 전송 오류: ${error.message}`, 'error');
  }
});

// 트랜잭션 전송 이벤트 핸들러
sendTxBtn.addEventListener('click', async () => {
  try {
    if (!client || !isClientConnected) {
      addLogEntry('client-log', '호스트에 연결되어 있지 않습니다. 먼저 연결하세요.', 'error');
      return;
    }
    
    addLogEntry('client-log', `간단한 트랜잭션 전송 중...`, 'request');
    
    // 가상의 트랜잭션 생성
    const sampleTransaction = {
      instructions: [
        {
          programId: SystemProgram.programId.toString(),
          accounts: [
            {
              pubkey: clientKeypair.publicKey.toString(),
              isSigner: true,
              isWritable: true
            },
            {
              pubkey: hostKeypair.publicKey.toString(),
              isSigner: false,
              isWritable: true
            }
          ],
          data: Buffer.from([2, 0, 0, 0, 100, 0, 0, 0, 0, 0, 0, 0]).toString('base64')
        }
      ],
      recentBlockhash: "GHtXQBsoZHVnNk5PxcuZPJMdkWEgFjwYbQzBUHnmxVVc"
    };
    
    // 트랜잭션 전송
    const sendTransactionRequest = async (transaction) => {
      try {
        // 트랜잭션 요청 생성
        const txRequest = {
          method: SalMethod.TX,
          data: transaction
        };
        
        // 트랜잭션 전송
        addLogEntry('client-log', `트랜잭션 요청 전송 중...`, 'request');
        await client.send(JSON.stringify(txRequest));
        
        addLogEntry('client-log', `트랜잭션이 성공적으로 전송되었습니다.`, 'request');
        return true;
      } catch (error) {
        addLogEntry('client-log', `트랜잭션 전송 실패: ${error.message}`, 'error');
        return false;
      }
    };
    
    await sendTransactionRequest(sampleTransaction);
  } catch (error) {
    addLogEntry('client-log', `트랜잭션 전송 오류: ${error.message}`, 'error');
  }
});

// 로그 출력 도우미 함수
function addLogEntry(logId, message, type = 'info') {
  const logDiv = document.getElementById(logId);
  if (!logDiv) {
    console.error(`로그 패널을 찾을 수 없습니다: ${logId}`);
    return;
  }
  
  // 콘솔에도 로깅
  console.log(`[${logId}] ${message}`);
  
  const entry = document.createElement('div');
  entry.className = `log-entry ${type}`;
  entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
  logDiv.appendChild(entry);
  logDiv.scrollTop = logDiv.scrollHeight;
}