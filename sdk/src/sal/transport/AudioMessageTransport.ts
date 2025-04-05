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
  
  /**
   * 오디오 샘플 배열을 다른 타입으로 변환하는 헬퍼 함수
   */
  private convertTypedArray(src: any, type: any) {
    const buffer = new ArrayBuffer(src.byteLength);
    new src.constructor(buffer).set(src);
    return new type(buffer);
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
    
    // 녹음 상태 저장
    const wasRecording = this.isRecording;
    
    // 출력 전 녹음 일시 중지 (피드백 방지)
    if (wasRecording) {
      console.log(`[${this.name}] 메시지 출력을 위해 마이크 감지 일시 중지`);
      this.stopListening();
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
            
            // 이전에 녹음 중이었다면 녹음 재개
            if (wasRecording) {
              console.log(`[${this.name}] 메시지 출력 완료 후 마이크 감지 재개`);
              setTimeout(() => {
                this.startListening().then(success => {
                  if (success) {
                    console.log(`[${this.name}] 마이크 감지 재개 성공`);
                  } else {
                    console.error(`[${this.name}] 마이크 감지 재개 실패`);
                  }
                });
              }, 100); // 약간의 딜레이를 두고 재개 (100ms)
            }
            
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
        
        // 오디오 신호 강도 계산
        const signalStrength = Math.sqrt(sourceBuf.reduce((sum, val) => sum + val * val, 0) / sourceBuf.length);
        
        processCount++;
        const now = Date.now();
        
        // 5초마다 로그 출력 (디버깅용)
        if (now - lastLog > 5000) {
          // console.log(`[${this.name}] 오디오 처리 중... (${processCount}회 처리됨)`);
          // console.log(`[${this.name}] 신호 강도:`, signalStrength.toFixed(6));
          lastLog = now;
        }
        
        try {
          // 모든 오디오 입력을 디코딩 시도하지 않고, 좀 더 엄격한 필터링 적용
          // 신호 강도가 특정 임계값을 넘을 때만 디코딩 시도
          if (signalStrength < 0.001) {
            return; // 신호가 너무 약하면 처리하지 않음
          }
          
          // 강한 신호가 감지되면 로그
          if (signalStrength > 0.01) {
            console.log(`[${this.name}] 강한 신호 감지: ${signalStrength.toFixed(6)}, 디코딩 시도`);
          }
          
          // ggwave 인스턴스 확인
          if (!this.instance || typeof this.instance !== 'number' || !this.ggwave) {
            console.error(`[${this.name}] ggwave 인스턴스가 유효하지 않습니다.`);
            return;
          }
          
          // 디코딩 시도 - audioUtils.ts의 구현 방식을 따라 수정
          try {
            // Float32Array를 Int8Array로 변환 (audioUtils.ts 방식으로)
            const result = this.ggwave.decode(
              this.instance,
              this.convertTypedArray(new Float32Array(sourceBuf), Int8Array)
            );
            
            // 결과 출력
            if (result && result.byteLength > 0) {
              console.log(`[${this.name}] 디코딩 결과: byteLength=${result.byteLength}`);
              
              // 문자열로 변환
              const text = new TextDecoder("utf-8").decode(result);
              console.log(`[${this.name}] 🎵 디코딩 성공! 메시지: "${text}"`);
              console.log(`[${this.name}] 📊 디코딩 정보: 결과크기=${result.byteLength}바이트, 메시지길이=${text.length}자`);
              
              // 디버깅용 - 바이너리 데이터 출력
              const bytes = Array.from(new Uint8Array(result))
                .map(b => b.toString(16).padStart(2, '0'))
                .join(' ');
              console.log(`[${this.name}] 📊 원시 바이트: ${bytes}`);
              
              // JSON 메시지인지 확인하고 안전하게 처리
              const isJsonMsg = text.trim().startsWith('{') && (text.trim().endsWith('}') || text.includes('"method":'));
              
              if (isJsonMsg) {
                try {
                  // JSON 문자열 정리 - 끝이 잘렸을 수 있음
                  let jsonText = text.trim();
                  
                  // 중간에 잘린 경우 처리 (끝 부분이 없는 경우)
                  if (!jsonText.endsWith('}')) {
                    console.warn(`[${this.name}] 불완전한 JSON이 감지됨: ${jsonText}`);
                    this.log(`불완전한 JSON 감지됨, 처리 시도 중...`, 'info');
                    
                    // 가능한 경우 끝 중괄호 추가
                    if (jsonText.includes('{"method":') || jsonText.includes('{"headers":')) {
                      // 중괄호 갯수 확인
                      const openCount = (jsonText.match(/{/g) || []).length;
                      const closeCount = (jsonText.match(/}/g) || []).length;
                      const missing = openCount - closeCount;
                      
                      if (missing > 0) {
                        // 빠진 만큼 닫는 중괄호 추가
                        jsonText += '}'.repeat(missing);
                        console.log(`[${this.name}] 누락된 중괄호 ${missing}개 추가: ${jsonText}`);
                      }
                    }
                  }
                  
                  // JSON 파싱 시도
                  const jsonObj = JSON.parse(jsonText);
                  
                  // 성공적으로 파싱된 경우 이벤트 발생
                  this.log(`JSON 메시지 수신 성공!`, 'response');
                  console.log(`[${this.name}] 📊 파싱된 JSON:`, jsonObj);
                  this.emitter.emit('message_received', jsonText);
                } catch (jsonErr) {
                  // JSON 파싱 실패
                  const errMsg = jsonErr instanceof Error ? jsonErr.message : String(jsonErr);
                  console.error(`[${this.name}] JSON 파싱 오류:`, errMsg);
                  this.log(`JSON 파싱 오류: ${errMsg}`, 'error');
                  
                  // 전송 성공 했지만 형식이 맞지 않으면 원본 텍스트 그대로 전달
                  if (text.trim().length > 0) {
                    this.log(`원본 텍스트 전달: ${text.substring(0, 30)}${text.length > 30 ? '...' : ''}`, 'info');
                    this.emitter.emit('message_received', text);
                  }
                }
              } else {
                // 일반 텍스트 메시지
                this.log(`디코딩된 메시지: ${text}`, 'response');
                this.emitter.emit('message_received', text);
              }
            } else {
              // 결과가 없을 때는 디버그 로그만
              if (signalStrength > 0.05) {
                console.log(`[${this.name}] 디코딩 시도 결과: 신호 감지되었으나 디코딩 실패`);
              }
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
    
    // 녹음 상태 저장
    const wasRecording = this.isRecording;
    
    // 출력 전 녹음 일시 중지 (피드백 방지)
    if (wasRecording) {
      console.log(`[${this.name}] 오디오 출력을 위해 마이크 감지 일시 중지`);
      this.stopListening();
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
          
          // 이전에 녹음 중이었다면 녹음 재개
          if (wasRecording) {
            console.log(`[${this.name}] 오디오 출력 완료 후 마이크 감지 재개`);
            setTimeout(() => {
              this.startListening().then(success => {
                if (success) {
                  console.log(`[${this.name}] 마이크 감지 재개 성공`);
                } else {
                  console.error(`[${this.name}] 마이크 감지 재개 실패`);
                }
              });
            }, 200); // 약간의 딜레이를 두고 재개 (200ms)
          }
          
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