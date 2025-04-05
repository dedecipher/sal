import { EventEmitter } from 'events';
import { MessageTransport } from '../../types';
import { GGWave, GGWaveParameters, GGWaveProtocolId } from '../../types/ggwave';

/**
 * AudioMessageTransport 설정 인터페이스
 */
export interface AudioMessageTransportConfig {
  name?: string;
  sampleRate?: number;
  volume?: number;
  logElement?: string;
}

/**
 * 오디오 기반 메시지 전송을 위한 클래스
 * 웹 오디오 API와 ggwave 라이브러리를 사용하여 오디오로 메시지를 인코딩/디코딩합니다.
 */
export class AudioMessageTransport implements MessageTransport {
  private name: string;
  private context: AudioContext | null = null;
  private ggwave: GGWave | null = null;
  private instance: number | null = null;
  private isRecording: boolean = false;
  private mediaStream: MediaStream | null = null;
  private recorder: ScriptProcessorNode | null = null;
  private emitter: EventEmitter;
  private messageHandler: ((message: string) => void) | null = null;
  private initialized: boolean = false;
  private logDiv: HTMLElement | null = null;
  
  /**
   * AudioMessageTransport 생성자
   * @param config 설정 객체
   */
  constructor(config: AudioMessageTransportConfig = {}) {
    this.name = config.name || 'AudioTransport';
    this.emitter = new EventEmitter();
    
    // 로그 기록용 div 요소
    const logElementId = config.logElement || `${this.name.toLowerCase()}-log`;
    this.logDiv = document.getElementById(logElementId);
    
    // 이벤트 핸들러 등록
    this.emitter.on('message_received', (message: string) => {
      this.log(`메시지 수신: ${message.substring(0, 30)}${message.length > 30 ? '...' : ''}`, 'response');
      if (this.messageHandler) {
        this.messageHandler(message);
      }
    });
  }
  
  /**
   * 로그 출력 함수
   * @param message 로그 메시지
   * @param type 로그 타입 (info, error, request, response)
   */
  private log(message: string, type: 'info' | 'error' | 'request' | 'response' = 'info'): void {
    console.log(`[${this.name}] ${message}`);
    
    if (!this.logDiv) {
      console.error(`[${this.name}] 로그 패널을 찾을 수 없습니다.`);
      return;
    }
    
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    this.logDiv.appendChild(entry);
    this.logDiv.scrollTop = this.logDiv.scrollHeight;
  }
  
  // 타입 변환 도우미 함수
  private convertTypedArray<T extends ArrayBufferView, U extends ArrayBufferView>(
    src: T, 
    type: { new(buffer: ArrayBuffer): U }
  ): U | null {
    try {
      const buffer = new ArrayBuffer(src.byteLength);
      new (src.constructor as any)(buffer).set(src);
      return new type(buffer);
    } catch (error) {
      console.error(`[${this.name}] 타입 변환 오류:`, error);
      
      // 대체 변환 방법 시도
      try {
        const temp = Array.from(new Float32Array(src.buffer));
        const result = new type(new ArrayBuffer(temp.length * 2));
        
        // Int16Array일 경우 스케일링 적용
        if (type.name === 'Int8Array') {
          for (let i = 0; i < temp.length; i++) {
            // 타입 캐스팅을 안전하게 처리
            const typedResult = result as unknown as Int8Array;
            typedResult[i] = Math.floor(temp[i] * 127);
          }
        } else {
          for (let i = 0; i < temp.length; i++) {
            (result as any)[i] = temp[i];
          }
        }
        
        return result;
      } catch (fallbackError) {
        console.error(`[${this.name}] 대체 타입 변환 실패:`, fallbackError);
        return null;
      }
    }
  }
  
  /**
   * ggwave 및 오디오 컨텍스트 초기화
   * @returns 초기화 성공 여부
   */
  public async initialize(): Promise<boolean> {
    if (this.initialized) return true;
    
    try {
      if (typeof window === 'undefined') {
        console.error('Window 객체가 없습니다. 브라우저 환경인지 확인하세요.');
        this.log('window 객체가 없습니다. 브라우저 환경인지 확인하세요.', 'error');
        return false;
      }
      
      console.log('Window 객체 확인됨, ggwave_factory 확인 중...', (window as any).ggwave_factory);
      
      if (!(window as any).ggwave_factory) {
        console.error('ggwave_factory가 없습니다. 스크립트가 로드되었는지 확인하세요.');
        this.log('ggwave 라이브러리가 로드되지 않았습니다.', 'error');
        
        // 전역 객체에 있는 모든 속성 출력 (디버깅용)
        console.log('Window 객체의 사용 가능한 속성:', Object.keys(window));
        return false;
      }
      
      this.log('오디오 컨텍스트 초기화 중...', 'info');
      
      // 오디오 컨텍스트 생성 - 특정 샘플 레이트 지정
      const sampleRate = 48000; // 48kHz 샘플 레이트 (ggwave에 적합)
      this.context = new AudioContext({ sampleRate: sampleRate });
      console.log(`[${this.name}] 오디오 컨텍스트 생성됨, 샘플 레이트: ${this.context.sampleRate}Hz`);
      
      // 웹 오디오 API 사용자 상호 작용 요구 사항
      if (this.context.state === 'suspended') {
        this.log('오디오 컨텍스트가 일시 중지되었습니다. 페이지와 상호 작용하세요.', 'info');
        console.log(`[${this.name}] 오디오 컨텍스트 상태: ${this.context.state}, 상호 작용 필요`);
        
        // 사용자 상호 작용이 필요할 수 있음을 안내
        document.addEventListener('click', () => {
          if (this.context && this.context.state === 'suspended') {
            this.context.resume().then(() => {
              console.log(`[${this.name}] 오디오 컨텍스트가 재개되었습니다.`);
            });
          }
        }, { once: true });
      }
      
      // ggwave 모듈 초기화
      console.log(`[${this.name}] ggwave_factory 호출 전...`);
      this.ggwave = await (window as any).ggwave_factory() as GGWave;
      console.log(`[${this.name}] ggwave_factory 호출 후, 결과:`, this.ggwave);
      
      // ggwave 기본 파라미터 가져오기 및 수정
      const parameters = this.ggwave.getDefaultParameters();
      console.log(`[${this.name}] 기본 파라미터:`, parameters);
      
      // 파라미터 조정 (성능 향상)
      parameters.sampleRateInp = this.context.sampleRate;
      parameters.sampleRateOut = this.context.sampleRate;
      parameters.soundMarkerThreshold = 8; // 마커 감지 임계값 증가 (노이즈 영향 감소)
      
      console.log(`[${this.name}] 조정된 파라미터:`, {
        sampleRateInp: parameters.sampleRateInp,
        sampleRateOut: parameters.sampleRateOut,
        soundMarkerThreshold: parameters.soundMarkerThreshold
      });
      
      console.log(`[${this.name}] ggwave.init 호출 전...`);
      this.instance = this.ggwave.init(parameters);
      console.log(`[${this.name}] ggwave.init 호출 후, 인스턴스:`, this.instance);
      
      // 인스턴스 검증
      if (!this.instance || this.instance === 0) {
        console.error(`[${this.name}] ggwave.init 실패: 인스턴스가 0이거나 유효하지 않음`);
        
        // 재시도 (다른 설정으로)
        console.log(`[${this.name}] ggwave 초기화 재시도 중...`);
        const defaultParams = this.ggwave.getDefaultParameters();
        // 기본 파라미터로 다시 시도
        this.instance = this.ggwave.init(defaultParams);
        console.log(`[${this.name}] 재시도 결과:`, this.instance);
        
        if (!this.instance || this.instance === 0) {
          this.log('ggwave 초기화 실패: 인스턴스를 생성할 수 없습니다', 'error');
          return false;
        }
      }
      
      // 사용 가능한 프로토콜 출력 (디버깅용)
      if (this.ggwave.ProtocolId) {
        console.log(`[${this.name}] 사용 가능한 프로토콜:`, this.ggwave.ProtocolId);
      }
      
      this.log('AudioMessageTransport 초기화됨', 'info');
      this.initialized = true;
      
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.log(`초기화 오류: ${errorMessage}`, 'error');
      console.error(`[${this.name}] 초기화 오류:`, error);
      return false;
    }
  }
  
  /**
   * 메시지 송신 메서드
   * @param message 전송할 메시지
   * @returns 전송 완료 Promise
   */
  public async sendMessage(message: string): Promise<void> {
    if (!this.initialized) {
      const success = await this.initialize();
      if (!success) {
        throw new Error('AudioMessageTransport 초기화에 실패했습니다.');
      }
    }
    
    try {
      // 메시지 유효성 검사 (엄격하게)
      if (message === undefined || message === null) {
        throw new Error('메시지가 null 또는 undefined입니다');
      }
      
      // 문자열로 변환 확보 및 엄격한 검증
      let messageStr = String(message);
      
      // 문자열 길이 검증
      if (messageStr.length === 0) {
        throw new Error('빈 메시지는 전송할 수 없습니다');
      }
      
      // 유효한 문자열인지 확인 (일부 특수문자나 이진 데이터가 들어오면 문제 발생 가능)
      const validRegex = /^[\x20-\x7E\uAC00-\uD7A3\u3130-\u318F]+$/; // ASCII 가능 문자 및 한글
      if (!validRegex.test(messageStr)) {
        console.warn(`[${this.name}] 메시지에 지원되지 않는 문자가 포함되어 있습니다. 필터링합니다.`);
        // 지원되지 않는 문자는 '?' 로 대체
        messageStr = messageStr.replace(/[^\x20-\x7E\uAC00-\uD7A3\u3130-\u318F]/g, '?');
      }
      
      console.log(`[${this.name}] 메시지 타입: ${typeof messageStr}, 값: "${messageStr}"`);
      
      this.log(`메시지 전송 중: "${messageStr}" (${messageStr.length} 바이트)`, 'request');
      console.log(`[${this.name}] 메시지 인코딩 시작: "${messageStr}"`);
      
      // ggwave 인스턴스 검증
      if (!this.ggwave) {
        throw new Error('ggwave가 초기화되지 않았습니다.');
      }
      
      if (!this.instance || this.instance === 0) {
        throw new Error('ggwave 인스턴스가 유효하지 않습니다. 재초기화가 필요합니다.');
      }
      
      // 프로토콜 확인 및 선택
      let protocol: number;
      if (this.ggwave.ProtocolId && this.ggwave.ProtocolId.GGWAVE_PROTOCOL_AUDIBLE_NORMAL !== undefined) {
        protocol = this.ggwave.ProtocolId.GGWAVE_PROTOCOL_AUDIBLE_NORMAL;
      } else if (this.ggwave.ProtocolId && this.ggwave.ProtocolId.GGWAVE_PROTOCOL_AUDIBLE_FAST !== undefined) {
        protocol = this.ggwave.ProtocolId.GGWAVE_PROTOCOL_AUDIBLE_FAST;
      } else {
        // 프로토콜을 찾을 수 없으면 기본값 사용
        protocol = 1; // GGWAVE_PROTOCOL_AUDIBLE_NORMAL 일반적으로 1
        console.log(`[${this.name}] 프로토콜 ID를 찾을 수 없어 기본값 사용:`, protocol);
      }
      
      const volume = 50; // 볼륨 증가 (0-100)
      
      console.log(`[${this.name}] 선택된 프로토콜: ${protocol}, 볼륨: ${volume}`);
      
      // 안전하게 인코딩 시도 (try/catch 내부에서)
      try {
        // 최종 타입 확인
        if (typeof messageStr !== 'string') {
          throw new Error(`messageStr은 문자열이어야 합니다. 현재 타입: ${typeof messageStr}`);
        }
        
        console.log(`[${this.name}] 인코딩 직전 확인 - messageStr=[${messageStr}], 타입=${typeof messageStr}, 길이=${messageStr.length}`);
        
        // ggwave로 메시지 인코딩
        const waveform = this.ggwave.encode(
          this.instance,
          messageStr,
          protocol,
          volume
        );
      
        if (!waveform || waveform.length === 0) {
          throw new Error('오디오 인코딩 실패: 빈 파형이 반환되었습니다.');
        }
        
        console.log(`[${this.name}] 인코딩 완료, 파형 길이: ${waveform.length} 샘플`);
        
        // Float32Array로 변환하여 오디오 버퍼 생성
        if (!this.context) {
          throw new Error('오디오 컨텍스트가 초기화되지 않았습니다.');
        }
        
        const buf = this.convertTypedArray(waveform, Float32Array);
        if (!buf) {
          throw new Error('파형 변환 실패');
        }
        
        const buffer = this.context.createBuffer(1, buf.length, this.context.sampleRate);
        buffer.getChannelData(0).set(buf);
        
        // 예상 재생 시간 (초)
        const duration = buffer.duration;
        console.log(`[${this.name}] 오디오 버퍼 생성됨, 길이: ${duration.toFixed(2)}초`);
        
        // 게인 노드를 통해 볼륨 조정 (추가적인 증폭)
        const gainNode = this.context.createGain();
        gainNode.gain.value = 2.0; // 기본 볼륨 증가 (1.0 -> 2.0)
        
        // 오디오 소스 생성 및 출력
        const source = this.context.createBufferSource();
        source.buffer = buffer;
        
        // 노드 연결: source -> gain -> destination
        source.connect(gainNode);
        gainNode.connect(this.context.destination);
        
        // 재생 시작
        source.start(0);
        console.log(`[${this.name}] 오디오 재생 시작`);
        
        this.log(`오디오 재생 중... (${waveform.length} 샘플)`, 'request');
        
        // 전송이 완료될 때까지 기다림 (인코딩된 오디오 길이 + 여유 시간)
        return new Promise<void>(resolve => {
          const waitTime = Math.min(waveform.length + 1000, 10000); // 밀리초 단위 (여유 시간 증가, 최대 10초)
          console.log(`[${this.name}] ${waitTime}ms 후 재생 완료 예정`);
          
          setTimeout(() => {
            this.log(`오디오 재생 완료`, 'request');
            console.log(`[${this.name}] 오디오 재생 완료`);
            resolve();
          }, waitTime);
        });
      } catch (encodeError) {
        const errorMessage = encodeError instanceof Error ? encodeError.message : String(encodeError);
        console.error(`[${this.name}] 인코딩 오류 발생:`, encodeError);
        this.log(`인코딩 오류: ${errorMessage}`, 'error');
        throw new Error(`오디오 인코딩 실패: ${errorMessage}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.log(`메시지 전송 실패: ${errorMessage}`, 'error');
      console.error(`[${this.name}] 메시지 전송 실패:`, error);
      throw error;
    }
  }
  
  /**
   * 메시지 수신 핸들러 등록
   * @param handler 메시지 수신 핸들러
   */
  public onMessage(handler: (message: string) => void): void {
    this.messageHandler = handler;
  }
  
  /**
   * 녹음 시작 및 메시지 수신 대기
   * @returns 녹음 시작 성공 여부
   */
  public async startListening(): Promise<boolean> {
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
      console.log(`[${this.name}] 마이크 접근 요청 중...`);
      
      // 마이크 접근 권한 요청
      const constraints = {
        audio: {
          echoCancellation: false,
          autoGainControl: false, 
          noiseSuppression: false
        }
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.log('마이크 접근 권한 획득 성공', 'info');
      console.log(`[${this.name}] 마이크 스트림 획득 성공:`, stream);
      this.mediaStream = stream;
      
      if (!this.context) {
        throw new Error('오디오 컨텍스트가 초기화되지 않았습니다.');
      }
      
      if (this.context.state === 'suspended') {
        await this.context.resume();
        console.log(`[${this.name}] 오디오 컨텍스트 재개됨`);
      }
      
      // 미디어 스트림 소스 노드 생성
      const mediaStreamSource = this.context.createMediaStreamSource(stream);
      console.log(`[${this.name}] 미디어 스트림 소스 노드 생성됨`);
      
      // 스크립트 프로세서 노드 생성 (AudioWorkletNode가 더 좋지만 간단히 구현)
      this.recorder = this.context.createScriptProcessor(4096, 1, 1);
      console.log(`[${this.name}] 스크립트 프로세서 노드 생성됨`);
      
      let processCount = 0;
      let lastLog = 0;
      
      // 오디오 처리 이벤트 핸들러
      this.recorder.onaudioprocess = (e) => {
        // 입력 버퍼에서 채널 데이터 가져오기
        const sourceBuf = e.inputBuffer.getChannelData(0);
        
        // 타입 변환 도우미 함수 (로컬 정의)
        const localConvertTypedArray = (
          src: Float32Array, 
          type: { new(buffer: ArrayBuffer): Int8Array }
        ): Int8Array | null => {
          try {
            const buffer = new ArrayBuffer(src.byteLength);
            new Float32Array(buffer).set(src);
            return new type(buffer);
          } catch (error) {
            console.error(`[${this.name}] 타입 변환 오류:`, error);
            
            // 대체 변환 방법 시도
            try {
              const temp = Array.from(src);
              const result = new Int8Array(temp.length);
              for (let i = 0; i < temp.length; i++) {
                result[i] = Math.floor(temp[i] * 32767);
              }
              return result;
            } catch (fallbackError) {
              console.error(`[${this.name}] 대체 타입 변환 실패:`, fallbackError);
              return null;
            }
          }
        };
        
        // 오디오 신호 강도 계산
        const signalStrength = Math.sqrt(sourceBuf.reduce((sum, val) => sum + val * val, 0) / sourceBuf.length);
        
        // 입력이 감지되었을 때 즉시 로그 (신호 강도가 임계값 이상)
        // if (signalStrength > 0.001) {
        //   console.log(`⚡ 마이크 입력 감지: 강도=${signalStrength.toFixed(6)}, 버퍼크기=${sourceBuf.length}`);
        // }
        
        // ggwave가 제대로 초기화되었는지 확인
        if (!this.initialized) {
          console.log(`[${this.name}] 초기화되지 않음. 오디오 처리 불가`);
          return;
        }
        
        if (!this.ggwave) {
          console.log(`[${this.name}] ggwave 객체가 없습니다. 오디오 처리 불가`);
          return;
        }
        
        if (!this.instance || this.instance === 0) {
          console.log(`[${this.name}] ggwave 인스턴스가 유효하지 않습니다.`);
          return;
        }
        
        processCount++;
        const now = Date.now();
        
        // 5초마다 로그 출력 (디버깅용)
        if (now - lastLog > 5000) {
          console.log(`[${this.name}] 오디오 처리 중... (${processCount}회 처리됨)`);
          console.log(`[${this.name}] 신호 강도:`, signalStrength.toFixed(6));
          lastLog = now;
        }
        
        // 신호 강도가 너무 낮으면 처리하지 않음 (CPU 자원 절약)
        if (signalStrength < 0.001) {
          if (now - lastLog > 5000) {
            console.log(`[${this.name}] 신호 강도가 너무 낮습니다. 처리 건너뜀`);
          }
          return;
        }
        
        // ggwave 인코딩 신호 패턴 감지 (기본적인 휴리스틱)
        let isEncodedSignal = false;
        
        // 1. 신호 패턴 분석 (간단한 방법)
        const audioSamples = Array.from(sourceBuf);
        let crossings = 0;
        let lastSign = Math.sign(audioSamples[0]);
        
        // 제로 크로싱 카운트 (주파수 관련 측정)
        for (let i = 1; i < audioSamples.length; i++) {
          const sign = Math.sign(audioSamples[i]);
          if (sign !== lastSign && sign !== 0) {
            crossings++;
            lastSign = sign;
          }
        }
        
        // ggwave는 일반적으로 특정 범위의 주파수를 사용
        // 크로싱 수가 특정 범위 내에 있으면 인코딩된 신호일 가능성이 높음
        const crossingRate = crossings / audioSamples.length;
        
        // 스펙트럼 패턴 분석 (추가 정보 제공)
        let peakFreq = 0;
        let energyConcentration = 0;
        
        // 신호 강도가 유의미하면 스펙트럼 분석
        if (signalStrength > 0.003) {
          // 신호의 주파수 특성 검사 (간단한 방법)
          let maxVal = 0;
          let maxIdx = 0;
          let energySum = 0;
          let highFreqEnergy = 0;
          
          // 신호의 최대값과 에너지 분포 확인
          for (let i = 0; i < audioSamples.length; i++) {
            const val = Math.abs(audioSamples[i]);
            energySum += val * val;
            
            if (val > maxVal) {
              maxVal = val;
              maxIdx = i;
            }
            
            // 고주파 에너지 계산 (간략화된 방법)
            if (i > audioSamples.length / 2) {
              highFreqEnergy += val * val;
            }
          }
          
          // 고주파 에너지 비율 (ggwave는 일반적으로 높은 주파수 사용)
          energyConcentration = highFreqEnergy / energySum;
          
          // 피크 주파수 추정 (매우 간략화된 방법)
          if (maxIdx > 0 && maxIdx < audioSamples.length - 1) {
            const periodSample = maxIdx;
            if (periodSample > 0 && this.context) {
              peakFreq = this.context.sampleRate / periodSample;
            }
          }
        }
        
        // 신호 감지 조건 검사 (크로싱 비율, 신호 강도, 에너지 분포)
        if (crossingRate > 0.05 && crossingRate < 0.5 && signalStrength > 0.005) {
          isEncodedSignal = true;
          console.log(`[${this.name}] 📡 ggwave 인코딩된 신호 감지! 크로싱=${crossingRate.toFixed(4)}, 강도=${signalStrength.toFixed(6)}, 에너지집중도=${energyConcentration.toFixed(4)}`);
          
          // 특성 정보 출력 (디버깅용)
          const buffer = new Uint8Array(10);
          for (let i = 0; i < Math.min(10, audioSamples.length); i++) {
            buffer[i] = Math.abs(Math.floor(audioSamples[i] * 255));
          }
          // console.log(`[${this.name}] 신호 샘플:`, Array.from(buffer).join(','), `피크주파수: ~${Math.round(peakFreq)}Hz`);
        } else if (now - lastLog > 5000) {
          console.log(`[${this.name}] 일반 오디오 신호: 크로싱=${crossingRate.toFixed(4)}, 강도=${signalStrength.toFixed(6)}`);
        }
        
        // 인코딩된 신호가 아니라고 판단되면 처리하지 않음
        if (!isEncodedSignal) {
          return;
        }
        
        try {
          // Int16Array로 변환 (원래 버퍼로부터 직접 변환)
          const samples = localConvertTypedArray(new Float32Array(sourceBuf), Int8Array);
          
          // 샘플이 유효한지 확인
          if (!samples || samples.length === 0) {
            console.error(`[${this.name}] 유효하지 않은 샘플 데이터`);
            return;
          }
          
          // 타입 확인 및 로깅 (5초마다)
          if (now - lastLog > 5000) {
            console.log(`[${this.name}] 디코딩 전 샘플 타입:`, samples.constructor.name, 
                       `길이:`, samples.length,
                       `처음 몇 개 값:`, Array.from(samples.slice(0, 5)));
          }
          
          try {
            // ggwave로 디코딩 시도
            let result: Uint8Array | null;
            
            // 데이터 유효성 검증 및 로깅
            if (!this.instance || typeof this.instance !== 'number') {
              console.error(`[${this.name}] 유효하지 않은 ggwave 인스턴스:`, this.instance);
              return;
            }
            
            if (!samples || !(samples instanceof Int8Array)) {
              // 타입 검사를 안전하게 처리
              console.error(`[${this.name}] 샘플 타입 오류:`, samples 
                ? (samples as unknown as { constructor: { name: string } }).constructor.name 
                : 'null');
              return;
            }
            
            // 이제 디코딩 시도
            result = this.ggwave.decode(this.instance, samples);
            
            // 디버깅을 위해 result 검사
            if (result) {
              console.log(`[${this.name}] 디코딩 결과: byteLength=${result.byteLength}, 타입=${result.constructor.name}`);
              
              // 디코딩된 바이너리 데이터를 JSON.stringify하여 출력
              try {
                const dataArray = Array.from(new Uint8Array(result));
                console.log(`[${this.name}] 디코딩 데이터(Array): ${JSON.stringify(dataArray)}`);
                
                // 텍스트로 변환하여 출력
                const textResult = new TextDecoder("utf-8").decode(result);
                console.log(`[${this.name}] 디코딩 데이터(String): "${textResult}"`);
                
                // 메시지 처리
                if (result.byteLength > 0) {
                  console.log(`[${this.name}] 🎵 디코딩 성공! 메시지: "${textResult}"`);
                  console.log(`[${this.name}] 📊 디코딩 정보: 결과크기=${result.byteLength}바이트, 메시지길이=${textResult.length}자, 샘플수=${samples.length}`);
                  
                  // 시간 측정
                  const decodingTime = Date.now() - now;
                  console.log(`[${this.name}] ⏱️ 디코딩 소요시간: ${decodingTime}ms`);
                  
                  // 로그 출력 및 이벤트 발생
                  this.log(`디코딩된 메시지: ${textResult}`, 'response');
                  this.emitter.emit('message_received', textResult);
                  
                  // 타임스탬프 업데이트 (다음 로그 출력까지 대기)
                  lastLog = Date.now() + 1000; // 1초간 추가 로그 억제
                }
              } catch (stringifyError) {
                console.error(`[${this.name}] 디코딩 데이터 출력 실패:`, stringifyError);
              }
            } else {
              console.log(`[${this.name}] 디코딩 결과 없음`);
              return;
            }
          } catch (decodeErr) {
            console.error(`[${this.name}] ggwave.decode 오류:`, decodeErr);
          }
        } catch (err) {
          console.error(`[${this.name}] 디코딩 중 오류:`, err);
        }
      };
      
      // 노드 연결
      mediaStreamSource.connect(this.recorder);
      this.recorder.connect(this.context.destination);
      
      this.log('마이크 녹음 및 메시지 수신 대기 시작', 'info');
      this.isRecording = true;
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.log(`녹음 시작 실패: ${errorMessage}`, 'error');
      console.error(`[${this.name}] 녹음 시작 실패:`, error);
      return false;
    }
  }
  
  /**
   * 녹음 중지 (메시지 수신 대기 중지)
   */
  public stopListening(): void {
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
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.log(`녹음 중지 실패: ${errorMessage}`, 'error');
      console.error('녹음 중지 실패:', error);
    }
  }
  
  /**
   * 연결 시작 (MessageTransport 인터페이스 구현)
   * @returns 연결 성공 여부
   */
  public async connect(): Promise<boolean> {
    const success = await this.startListening();
    return success;
  }
  
  /**
   * 연결 해제 (MessageTransport 인터페이스 구현)
   * @returns Promise<void>
   */
  public async disconnect(): Promise<void> {
    this.stopListening();
    return Promise.resolve();
  }

  /**
   * 오디오 버퍼 재생 (직접 오디오 데이터 재생)
   * @param waveform 재생할 오디오 파형 데이터
   * @returns 재생 완료 Promise
   */
  public async play(waveform: AudioBuffer): Promise<void> {
    if (!this.context) {
      console.error(`[${this.name}] 오디오 컨텍스트가 초기화되지 않았습니다.`);
      const success = await this.initialize();
      if (!success) {
        throw new Error('오디오 컨텍스트 초기화 실패');
      }
    }
    
    if (this.context!.state !== 'running') {
      try {
        console.log(`[${this.name}] 오디오 컨텍스트 상태가 ${this.context!.state}입니다. 재개 시도.`);
        await this.context!.resume();
        console.log(`[${this.name}] 오디오 컨텍스트가 재개되었습니다. 상태:`, this.context!.state);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[${this.name}] 오디오 컨텍스트 재개 실패:`, error);
        this.log('오디오 컨텍스트를 재개할 수 없습니다', 'error');
        throw error;
      }
    }
    
    if (!waveform || waveform.length === 0) {
      console.error(`[${this.name}] 재생할 파형이 없습니다.`);
      this.log('재생할 오디오 데이터가 없습니다', 'error');
      return;
    }
    
    console.log(`[${this.name}] 오디오 재생 준비, 파형 길이:`, waveform.length);
    
    try {
      // 게인 노드를 통해 볼륨 조정 (추가적인 증폭)
      const gainNode = this.context!.createGain();
      gainNode.gain.value = 2.0; // 기본 볼륨 증가 (1.0 -> 2.0)
      
      // 압축기 노드 추가 (다이나믹 레인지 압축으로 더 선명한 사운드)
      const compressor = this.context!.createDynamicsCompressor();
      compressor.threshold.value = -50;
      compressor.knee.value = 40;
      compressor.ratio.value = 12;
      compressor.attack.value = 0.002;
      compressor.release.value = 0.25;
      
      // 오디오 소스 생성 및 출력
      const source = this.context!.createBufferSource();
      source.buffer = waveform;
      
      // 노드 연결: source -> gain -> compressor -> destination
      source.connect(gainNode);
      gainNode.connect(compressor);
      compressor.connect(this.context!.destination);
      
      // 재생 시작
      source.start(0);
      console.log(`[${this.name}] 오디오 재생 시작`);
      
      this.log(`오디오 재생 중... (${waveform.length} 샘플)`, 'request');
      
      // 전송이 완료될 때까지 기다림 (인코딩된 오디오 길이 + 여유 시간)
      return new Promise<void>(resolve => {
        const waitTime = Math.min(waveform.length + 1000, 10000); // 밀리초 단위 (여유 시간 증가, 최대 10초)
        console.log(`[${this.name}] ${waitTime}ms 후 재생 완료 예정`);
        
        setTimeout(() => {
          this.log(`오디오 재생 완료`, 'request');
          console.log(`[${this.name}] 오디오 재생 완료`);
          resolve();
        }, waitTime);
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[${this.name}] 오디오 재생 실패:`, error);
      this.log(`오디오 재생 실패: ${errorMessage}`, 'error');
      throw error;
    }
  }
} 