/**
 * 오디오 인코딩/디코딩을 위한 모듈
 * ggwave 라이브러리를 사용하여 메시지를 오디오로 변환하고, 오디오를 메시지로 변환하는 기능을 제공합니다.
 */
import { EventEmitter } from 'events';
import type { GGWaveModule, GGWaveInstance } from 'ggwave';

// 오디오 이벤트 타입
export interface AudioEvent {
  message: string;
  source: 'self' | 'external';
}

// 오디오 이벤트 리스너 타입
export type AudioEventListener = (event: AudioEvent) => void;

// GGWave 스크립트를 로드하는 함수
function loadGGWaveScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      console.warn('[CODEC] 브라우저 환경이 아닙니다. ggwave를 로드할 수 없습니다.');
      reject(new Error('브라우저 환경이 아닙니다'));
      return;
    }

    // 이미 로드되었거나 로드 중인 경우
    if ((window as any).ggwave_factory) {
      console.log('[CODEC] ggwave_factory가 이미 로드되어 있습니다.');
      resolve();
      return;
    }

    // 웹팩 설정에서 정의한 GGWAVE_READY Promise 사용
    if ((window as any).GGWAVE_READY) {
      console.log('[CODEC] ggwave 모듈 로드 대기 중...');
      (window as any).GGWAVE_READY
        .then(() => {
          console.log('[CODEC] ggwave 모듈 로드 완료');
          resolve();
        })
        .catch((err: Error) => {
          console.error('[CODEC] ggwave 모듈 로드 실패:', err);
          reject(err);
        });
      return;
    }

    // GGWAVE_READY가 없는 경우 수동으로 로드 시도
    console.warn('[CODEC] GGWAVE_READY가 정의되지 않았습니다. 수동 로드를 시도합니다.');
    try {
      const scriptSrc = document.currentScript instanceof HTMLScriptElement 
        ? document.currentScript.src 
        : '';
      const basePath = scriptSrc.substring(0, scriptSrc.lastIndexOf('/') + 1);
      
      // WASM 파일 경로 설정
      (window as any).GGWAVE_WASM_URL = `${basePath}ggwave.wasm`;
      
      // ggwave.js 스크립트 로드
      const script = document.createElement('script');
      script.src = `${basePath}ggwave.js`;
      script.async = true;
      
      script.onload = () => {
        console.log('[CODEC] ggwave.js 로드 완료');
        if ((window as any).ggwave_factory) {
          resolve();
        } else {
          console.error('[CODEC] ggwave_factory 객체를 찾을 수 없습니다.');
          reject(new Error('ggwave_factory 객체를 찾을 수 없습니다'));
        }
      };
      
      script.onerror = () => {
        console.error('[CODEC] ggwave.js 로드 실패');
        reject(new Error('ggwave.js 로드 실패'));
      };
      
      document.head.appendChild(script);
    } catch (err) {
      console.error('[CODEC] 스크립트 로드 중 오류:', err);
      reject(err);
    }
  });
}

// Helper function to convert array types
function convertTypedArray(src: Float32Array | Int8Array | Int16Array, type: { new(length: number): any; new(buffer: ArrayBuffer): any }): any {
  if (!src || !src.buffer) {
    console.error('[CODEC] 유효하지 않은 배열 변환 시도');
    return new type(0);
  }
  
  try {
    const buffer = new ArrayBuffer(src.byteLength);
    new (src.constructor as any)(buffer).set(src);
    return new type(buffer);
  } catch (err) {
    console.error('[CODEC] 배열 변환 실패:', err);
    return new type(0);
  }
}

export class AudioCodec extends EventEmitter {
  private context: AudioContext | null = null;
  private ggwave: GGWaveModule | null = null;
  private instance: GGWaveInstance | null = null;
  private mediaStreamInstance: MediaStream | null = null;
  private mediaStream: MediaStreamAudioSourceNode | null = null;
  private recorder: ScriptProcessorNode | null = null;
  private isRecording = false;
  private userId: string;
  private isLoading = false;
  private initPromise: Promise<boolean> | null = null;

  constructor(userId?: string) {
    super();
    this.userId = userId || Math.random().toString(36).substring(2, 4).toUpperCase();
  }

  /**
   * 오디오 이벤트 리스너를 등록합니다.
   */
  public onMessage(listener: AudioEventListener): void {
    this.on('message', listener);
  }

  /**
   * 오디오 시스템을 초기화합니다.
   */
  public async init(): Promise<boolean> {
    // 이미 초기화 중이라면 진행 중인 Promise 반환
    if (this.isLoading && this.initPromise) {
      return this.initPromise;
    }
    
    // 이미 초기화되었다면 true 반환
    if (this.context && this.ggwave && this.instance) {
      return true;
    }
    
    this.isLoading = true;
    
    this.initPromise = new Promise(async (resolve) => {
      try {
        console.log('[CODEC] 오디오 시스템 초기화 중...');
        
        // AudioContext 초기화
        if (!this.context) {
          if (typeof window === 'undefined') {
            console.error('[CODEC] 브라우저 환경이 아닙니다.');
            this.isLoading = false;
            resolve(false);
            return;
          }
          
          const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
          if (!AudioContextClass) {
            console.error('[CODEC] AudioContext를 지원하지 않는 브라우저입니다.');
            this.isLoading = false;
            resolve(false);
            return;
          }
          
          this.context = new AudioContextClass({ sampleRate: 48000 });
          
          // AudioContext 상태가 suspended인 경우 사용자 인터랙션 필요
          if (this.context.state === 'suspended') {
            console.warn('[CODEC] AudioContext가 suspended 상태입니다. 사용자 인터랙션이 필요합니다.');
          }
        }

        // ggwave 로딩
        if (!this.ggwave && typeof window !== 'undefined') {
          console.log('[CODEC] ggwave 로딩 중...');
          
          try {
            // ggwave.js 스크립트 로드 확인 및 로드
            await loadGGWaveScript();
            
            if (!(window as any).ggwave_factory) {
              console.error('[CODEC] ggwave_factory를 찾을 수 없습니다.');
              this.isLoading = false;
              resolve(false);
              return;
            }
            
            // ggwave 인스턴스 초기화
            this.ggwave = await (window as any).ggwave_factory();
            
            if (this.ggwave) {
              const parameters = this.ggwave.getDefaultParameters();
              
              if (this.context) {
                parameters.sampleRateInp = this.context.sampleRate;
                parameters.sampleRateOut = this.context.sampleRate;
              }
              
              parameters.soundMarkerThreshold = 4;
              
              this.instance = this.ggwave.init(parameters);
              console.log('[CODEC] ggwave 초기화 완료', { instance: !!this.instance });
            } else {
              console.error('[CODEC] ggwave 초기화 실패');
              this.isLoading = false;
              resolve(false);
              return;
            }
          } catch (err) {
            console.error('[CODEC] ggwave 로딩 실패:', err);
            this.isLoading = false;
            resolve(false);
            return;
          }
        }

        this.isLoading = false;
        resolve(!!(this.context && this.ggwave && this.instance));
      } catch (error) {
        console.error('[CODEC] 오디오 초기화 실패:', error);
        this.isLoading = false;
        resolve(false);
      }
    });
    
    return this.initPromise;
  }

  /**
   * 마이크를 사용하여 오디오 수신을 시작합니다.
   */
  public async startListening(): Promise<boolean> {
    if (this.isRecording) return true;
    
    if (!await this.init()) {
      console.error('[CODEC] 오디오 초기화 실패로 수신을 시작할 수 없습니다.');
      return false;
    }
    
    try {
      if (!this.context) {
        console.error('[CODEC] AudioContext가 없습니다.');
        return false;
      }
      
      // AudioContext가 suspended 상태라면 resume 시도
      if (this.context.state === 'suspended') {
        try {
          await this.context.resume();
          console.log('[CODEC] AudioContext 재개됨');
        } catch (err) {
          console.warn('[CODEC] AudioContext 재개 실패:', err);
        }
      }
      
      // 마이크 액세스 요청
      try {
        this.mediaStreamInstance = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false
          }
        });
      } catch (err) {
        console.error('[CODEC] 마이크 액세스 실패:', err);
        return false;
      }
      
      this.mediaStream = this.context.createMediaStreamSource(this.mediaStreamInstance);
      
      // 오디오 프로세서 생성
      try {
        // ScriptProcessorNode는 deprecated이지만 호환성을 위해 유지
        // 나중에 AudioWorklet으로 마이그레이션 필요
        this.recorder = this.context.createScriptProcessor(8192, 1, 1);
      } catch (err) {
        console.error('[CODEC] 오디오 프로세서 생성 실패:', err);
        this.stopListening();
        return false;
      }
      
      // 오디오 데이터 처리
      this.recorder.onaudioprocess = (e: AudioProcessingEvent) => {
        if (!this.ggwave || !this.instance) {
          console.error('[CODEC] ggwave 또는 인스턴스가 초기화되지 않았습니다.');
          return;
        }
        
        try {
          const sourceBuf = e.inputBuffer.getChannelData(0);
          const int8Samples = convertTypedArray(new Float32Array(sourceBuf), Int8Array);
          
          if (!int8Samples || int8Samples.length === 0) {
            return;
          }
          
          const res = this.ggwave.decode(this.instance, int8Samples);

          if (res && res.length > 0) {
            try {
              const text = new TextDecoder("utf-8").decode(res);
              
              // 송신자 ID가 있는 경우 자신의 메시지 무시
              if (text.startsWith(`${this.userId}$`)) {
                console.log("[CODEC] 자신의 메시지 무시:", text);
                return;
              }
              
              // ID 접두사 제거
              const cleanMessage = text.includes('$') ? text.split('$').slice(1).join('$') : text;
              
              this.emit('message', {
                message: cleanMessage,
                source: 'external'
              });
            } catch (decodeErr) {
              console.error('[CODEC] 텍스트 디코딩 실패:', decodeErr);
            }
          }
        } catch (processErr) {
          console.error('[CODEC] 오디오 처리 실패:', processErr);
        }
      };

      // 오디오 그래프 연결
      if (this.mediaStream && this.recorder) {
        this.mediaStream.connect(this.recorder);
        this.recorder.connect(this.context.destination);
      }

      this.isRecording = true;
      console.log('[CODEC] 오디오 수신 시작됨');
      return true;
    } catch (err) {
      console.error('[CODEC] 오디오 수신 시작 실패:', err);
      this.stopListening(); // 리소스 정리
      return false;
    }
  }

  /**
   * 오디오 수신을 중지합니다.
   */
  public stopListening(): void {
    if (!this.isRecording) return;
    
    try {
      if (this.recorder) {
        this.recorder.disconnect();
        this.recorder = null;
      }
      
      if (this.mediaStream) {
        this.mediaStream.disconnect();
        this.mediaStream = null;
      }
      
      if (this.mediaStreamInstance) {
        this.mediaStreamInstance.getTracks().forEach(track => track.stop());
        this.mediaStreamInstance = null;
      }
      
      this.isRecording = false;
      console.log('[CODEC] 오디오 수신 중지됨');
    } catch (err) {
      console.error('[CODEC] 오디오 수신 중지 중 오류:', err);
    }
  }

  /**
   * 메시지를 오디오로 인코딩하여 재생합니다.
   */
  public async sendMessage(message: string, fastest: boolean = false): Promise<boolean> {
    try {
      if (!await this.init() || !this.context || !this.ggwave || !this.instance) {
        console.error('[CODEC] 오디오 메시지 전송 실패: 초기화되지 않음');
        return false;
      }
      
      // AudioContext가 suspended 상태라면 resume 시도
      if (this.context.state === 'suspended') {
        try {
          await this.context.resume();
          console.log('[CODEC] AudioContext 재개됨');
        } catch (err) {
          console.warn('[CODEC] AudioContext 재개 실패:', err);
          return false;
        }
      }
      
      // ID 접두사 추가
      const encodedMessage = `${this.userId}$${message}`;

      // 프로토콜 선택 (빠른 전송 또는 일반 전송)
      const protocol = fastest 
        ? this.ggwave.ProtocolId.GGWAVE_PROTOCOL_AUDIBLE_FASTEST 
        : this.ggwave.ProtocolId.GGWAVE_PROTOCOL_AUDIBLE_FAST;
      
      // 메시지를 오디오 파형으로 인코딩
      const waveform = this.ggwave.encode(
        this.instance,
        encodedMessage,
        protocol,
        10 // 볼륨
      );

      if (!waveform || waveform.length === 0) {
        console.error('[CODEC] 오디오 인코딩 실패');
        return false;
      }

      // 오디오 버퍼 생성 및 재생
      try {
        const buf = convertTypedArray(waveform, Float32Array);
        const buffer = this.context.createBuffer(1, buf.length, this.context.sampleRate);
        buffer.getChannelData(0).set(buf);
        
        const source = this.context.createBufferSource();
        source.buffer = buffer;
        source.connect(this.context.destination);
        
        // 완료 이벤트
        source.onended = () => {
          this.emit('message', {
            message,
            source: 'self'
          });
        };
        
        source.start(0);
        return true;
      } catch (playErr) {
        console.error('[CODEC] 오디오 재생 실패:', playErr);
        return false;
      }
    } catch (error) {
      console.error('[CODEC] 메시지 전송 실패:', error);
      return false;
    }
  }

  /**
   * 리소스를 정리합니다.
   */
  public dispose(): void {
    this.stopListening();
    
    try {
      if (this.context && this.context.state !== 'closed') {
        this.context.close().catch(err => {
          console.error('[CODEC] AudioContext 종료 실패:', err);
        });
      }
    } catch (err) {
      console.error('[CODEC] 리소스 정리 중 오류:', err);
    }
    
    this.context = null;
    this.ggwave = null;
    this.instance = null;
    this.removeAllListeners();
    console.log('[CODEC] 리소스 정리 완료');
  }
}