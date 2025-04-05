// AudioMessageTransport.js
import { SalClient } from '../sdk/src/sal/client';
import { SalHost } from '../sdk/src/sal/host';
import { EventEmitter } from 'events';

// 오디오 기반 메시지 트랜스포트 클래스
export class AudioMessageTransport {
  constructor(name) {
    this.name = name;
    this.messageHandler = null;
    this.context = null;
    this.ggwave = null;
    this.instance = null;
    this.isRecording = false;
    this.mediaStream = null;
    this.recorder = null;
    this.emitter = new EventEmitter();
    
    // 로그 기록용 div 요소
    this.logDiv = document.getElementById(`${name.toLowerCase()}-log`);
    
    // ggwave 초기화 상태
    this.initialized = false;
    
    // 이벤트 핸들러 등록
    this.emitter.on('message_received', (message) => {
      this.log(`메시지 수신: ${message.substring(0, 30)}${message.length > 30 ? '...' : ''}`, 'response');
      if (this.messageHandler) {
        this.messageHandler(message);
      }
    });
  }
  
  // ggwave 및 오디오 컨텍스트 초기화
  async initialize() {
    if (this.initialized) return true;
    
    try {
      if (!window) {
        console.error('Window 객체가 없습니다. 브라우저 환경인지 확인하세요.');
        this.log('window 객체가 없습니다. 브라우저 환경인지 확인하세요.', 'error');
        return false;
      }
      
      console.log('Window 객체 확인됨, ggwave_factory 확인 중...', window.ggwave_factory);
      
      if (!window.ggwave_factory) {
        console.error('ggwave_factory가 없습니다. 스크립트가 로드되었는지 확인하세요.');
        this.log('ggwave 라이브러리가 로드되지 않았습니다.', 'error');
        
        // 전역 객체에 있는 모든 속성 출력 (디버깅용)
        console.log('Window 객체의 사용 가능한 속성:', Object.keys(window));
        return false;
      }
      
      this.log('오디오 컨텍스트 초기화 중...', 'info');
      
      // 오디오 컨텍스트 생성
      this.context = new AudioContext({ sampleRate: 48000 });
      
      // ggwave 모듈 초기화
      console.log('ggwave_factory 호출 전...');
      this.ggwave = await window.ggwave_factory();
      console.log('ggwave_factory 호출 후, 결과:', this.ggwave);
      
      const parameters = this.ggwave.getDefaultParameters();
      console.log('기본 파라미터:', parameters);
      
      parameters.sampleRateInp = this.context.sampleRate;
      parameters.sampleRateOut = this.context.sampleRate;
      parameters.soundMarkerThreshold = 4;
      
      console.log('ggwave.init 호출 전...');
      this.instance = this.ggwave.init(parameters);
      console.log('ggwave.init 호출 후, 인스턴스:', this.instance);
      
      this.log('AudioMessageTransport 초기화됨', 'info');
      this.initialized = true;
      
      return true;
    } catch (error) {
      this.log(`초기화 오류: ${error.message}`, 'error');
      console.error('초기화 오류:', error);
      return false;
    }
  }
  
  // 로그 출력 함수
  log(message, type = 'info') {
    console.log(`[${this.name}] ${message}`);
    
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
  
  // 메시지 송신 메서드
  async sendMessage(message) {
    if (!this.initialized) {
      const success = await this.initialize();
      if (!success) {
        throw new Error('AudioMessageTransport 초기화에 실패했습니다.');
      }
    }
    
    try {
      this.log(`메시지 전송 중... (${message.length} 바이트)`, 'request');
      
      // ggwave로 메시지 인코딩
      const waveform = this.ggwave.encode(
        this.instance,
        message,
        this.ggwave.ProtocolId.GGWAVE_PROTOCOL_AUDIBLE_FAST,
        10 // 볼륨
      );
      
      // 타입 변환 도우미 함수
      const convertTypedArray = (src, type) => {
        const buffer = new ArrayBuffer(src.byteLength);
        new src.constructor(buffer).set(src);
        return new type(buffer);
      };
      
      // Float32Array로 변환하여 오디오 버퍼 생성
      const buf = convertTypedArray(waveform, Float32Array);
      const buffer = this.context.createBuffer(1, buf.length, this.context.sampleRate);
      buffer.getChannelData(0).set(buf);
      
      // 오디오 소스 생성 및 출력
      const source = this.context.createBufferSource();
      source.buffer = buffer;
      source.connect(this.context.destination);
      source.start(0);
      
      this.log(`메시지 전송 완료`, 'request');
      
      // 전송이 완료될 때까지 기다림 (대략적인 시간)
      return new Promise(resolve => {
        setTimeout(() => resolve(), buffer.duration * 1000 + 500);
      });
    } catch (error) {
      this.log(`메시지 전송 실패: ${error.message}`, 'error');
      throw error;
    }
  }
  
  // 메시지 수신 핸들러 등록
  onMessage(handler) {
    this.messageHandler = handler;
  }
  
  // 녹음 시작 (메시지 수신 대기)
  async startListening() {
    if (!this.initialized) {
      const success = await this.initialize();
      if (!success) {
        return false;
      }
    }
    
    if (this.isRecording) {
      this.log('이미 녹음 중입니다.', 'info');
      return true;
    }
    
    try {
      this.log('메시지 수신 대기 중...', 'info');
      
      // 마이크 접근 권한 요청
      const constraints = {
        audio: {
          echoCancellation: false,
          autoGainControl: false, 
          noiseSuppression: false
        }
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.mediaStream = stream;
      
      if (this.context.state === 'suspended') {
        await this.context.resume();
      }
      
      // 미디어 스트림 소스 노드 생성
      const mediaStreamSource = this.context.createMediaStreamSource(stream);
      
      // 스크립트 프로세서 노드 생성 (AudioWorkletNode가 더 좋지만 간단히 구현)
      this.recorder = this.context.createScriptProcessor(4096, 1, 1);
      
      // 타입 변환 도우미 함수
      const convertTypedArray = (src, type) => {
        const buffer = new ArrayBuffer(src.byteLength);
        new src.constructor(buffer).set(src);
        return new type(buffer);
      };
      
      // 오디오 처리 이벤트 핸들러
      this.recorder.onaudioprocess = (e) => {
        if (!this.initialized || !this.ggwave || !this.instance) return;
        
        // 입력 버퍼에서 채널 데이터 가져오기
        const sourceBuf = e.inputBuffer.getChannelData(0);
        
        // ggwave로 디코딩
        const result = this.ggwave.decode(
          this.instance, 
          convertTypedArray(new Float32Array(sourceBuf), Int16Array)
        );
        
        // 디코딩된 메시지가 있으면 처리
        if (result && result.byteLength > 0) {
          const text = new TextDecoder('utf-8').decode(result);
          console.log('디코딩된 메시지:', text);
          this.emitter.emit('message_received', text);
        }
      };
      
      // 노드 연결 (스크립트 프로세서 출력은 필요 없음)
      mediaStreamSource.connect(this.recorder);
      this.recorder.connect(this.context.destination);
      
      this.isRecording = true;
      return true;
    } catch (error) {
      this.log(`녹음 시작 실패: ${error.message}`, 'error');
      console.error('녹음 시작 실패:', error);
      return false;
    }
  }
  
  // 녹음 중지 (메시지 수신 대기 중지)
  stopListening() {
    if (!this.isRecording) {
      this.log('녹음 중이 아닙니다.', 'info');
      return;
    }
    
    try {
      this.log('메시지 수신 대기 중지...', 'info');
      
      // 리소스 정리
      if (this.recorder) {
        this.recorder.disconnect();
        this.recorder = null;
      }
      
      if (this.mediaStream) {
        this.mediaStream.getTracks().forEach(track => track.stop());
        this.mediaStream = null;
      }
      
      this.isRecording = false;
    } catch (error) {
      this.log(`녹음 중지 실패: ${error.message}`, 'error');
      console.error('녹음 중지 실패:', error);
    }
  }
  
  // 연결 시작
  async connect() {
    const success = await this.startListening();
    return success;
  }
  
  // 연결 해제
  async disconnect() {
    this.stopListening();
    return Promise.resolve();
  }
} 