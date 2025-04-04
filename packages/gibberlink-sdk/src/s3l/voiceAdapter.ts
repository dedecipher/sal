import { EventEmitter } from 'events';
import { S3lJsonMessage, S3lJsonResponse } from '../solana/types';
import * as fs from 'fs';
import * as path from 'path';

// 노드 환경에서만 사용하는 모듈
let nodeWav: any = null;
let Speaker: any = null;
let playSound: any = null;

// 노드 환경일 때만 모듈 로드
if (typeof window === 'undefined') {
  try {
    nodeWav = require('node-wav');
    playSound = require('play-sound')();
    try {
      Speaker = require('speaker');
    } catch (err) {
      console.log('Speaker module not available, will use play-sound instead');
    }
  } catch (err) {
    console.log('Audio modules not available in Node environment:', err);
  }
}

// GGWave 타입 정의
interface GGWaveParameters {
  sampleRateInp?: number;
  sampleRateOut?: number;
  soundMarkerThreshold?: number;
  [key: string]: any;
}

interface GGWaveInstance {
  [key: string]: any;
}

interface GGWaveModule {
  getDefaultParameters(): GGWaveParameters;
  init(params: GGWaveParameters): GGWaveInstance;
  encode(instance: GGWaveInstance, message: string, protocol: number, volume: number): Int16Array;
  decode(instance: GGWaveInstance, samples: Int16Array): Uint8Array | null;
  ProtocolId: {
    GGWAVE_PROTOCOL_AUDIBLE_NORMAL: number;
    GGWAVE_PROTOCOL_AUDIBLE_FAST: number;
    GGWAVE_PROTOCOL_AUDIBLE_FASTEST: number;
    [key: string]: number;
  };
}

// Helper function to convert array types
function convertTypedArray(src: any, type: any): any {
  const buffer = new ArrayBuffer(src.byteLength);
  new src.constructor(buffer).set(src);
  return new type(buffer);
}

/**
 * S3L Voice 모달리티를 위한 옵션
 */
export interface VoiceAdapterOptions {
  sampleRate?: number;
  soundMarkerThreshold?: number;
  userId?: string;
  chunkSize?: number;
}

/**
 * S3L Voice 어댑터 클래스
 * GGWave를 직접 사용하여 오디오 기반 통신을 구현합니다.
 */
export class VoiceAdapter extends EventEmitter {
  private context: any = null;
  private ggwave: GGWaveModule | null = null;
  private instance: GGWaveInstance | null = null;
  private mediaStreamInstance: any = null;
  private mediaStream: any = null;
  private recorder: any = null;
  private analyserNode: any = null;
  private isRecording = false;
  private userId: string;
  private messageBuffer: string = '';
  private chunkSize: number;
  private isBrowser: boolean;

  /**
   * 생성자
   */
  constructor(options: VoiceAdapterOptions = {}) {
    super();
    
    this.userId = options.userId || Math.random().toString(36).substring(2, 4).toUpperCase();
    this.chunkSize = options.chunkSize || 200;
    this.isBrowser = typeof window !== 'undefined';
    
    // 바인딩
    this.initAudio = this.initAudio.bind(this);
    this.startListening = this.startListening.bind(this);
    this.stopListening = this.stopListening.bind(this);
    this.sendMessage = this.sendMessage.bind(this);
    this.createAnalyserNode = this.createAnalyserNode.bind(this);
  }

  /**
   * GGWave 및 오디오 초기화
   */
  public async initAudio(newContext?: any): Promise<boolean> {
    try {
      // 브라우저 환경이 아닌 경우 모의 구현만 제공
      if (!this.isBrowser) {
        console.log('S3L SDK: Running in non-browser environment, providing mock implementation');
        return true;
      }
      
      if (newContext) {
        this.context = newContext;
      } else if (!this.context && this.isBrowser) {
        const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          this.context = new AudioContextClass({ sampleRate: 48000 });
        }
      }

      // ggwave가 아직 로드되지 않았을 때 로드 대기
      if (!this.ggwave && this.isBrowser) {
        console.log('S3L SDK: Waiting for ggwave to load...');
        if (!(window as any).ggwave_factory) {
          // ggwave 스크립트 로드 확인
          const ggwaveScript = document.querySelector('script[src*="ggwave.js"]');
          if (!ggwaveScript) {
            console.error('S3L SDK: ggwave.js script not found in document');
            throw new Error('ggwave.js script not found. Please include it in your HTML.');
          }
          
          // ggwave 로드 대기 (최대 5초)
          let retries = 0;
          while (!(window as any).ggwave_factory && retries < 50) {
            await new Promise(resolve => setTimeout(resolve, 100));
            retries++;
          }
          
          if (!(window as any).ggwave_factory) {
            console.error('S3L SDK: ggwave_factory not available after waiting');
            throw new Error('Failed to load ggwave_factory');
          }
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
          console.log('S3L SDK: ggwave initialized');
        } else {
          console.error('S3L SDK: Failed to initialize ggwave');
          throw new Error('Failed to initialize ggwave');
        }
      }

      return !!(this.context && this.ggwave && this.instance) || !this.isBrowser;
    } catch (error) {
      console.error('S3L SDK: Failed to initialize audio:', error);
      this.emit('error', error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  /**
   * 메시지 수신을 위한 오디오 녹음 시작
   */
  public async startListening(): Promise<boolean> {
    if (this.isRecording) return true;
    
    // 브라우저 환경이 아닌 경우 모의 구현만 제공
    if (!this.isBrowser) {
      console.log('S3L SDK: Mock voice listening started in non-browser environment');
      this.isRecording = true;
      this.emit('connectionStateChanged', true);
      return true;
    }

    await this.initAudio();

    const constraints = {
      audio: {
        echoCancellation: false,
        autoGainControl: false,
        noiseSuppression: false,
      },
    };

    try {
      const stream = await (navigator as any).mediaDevices.getUserMedia(constraints);
      this.mediaStreamInstance = stream;
      
      if (!this.context) {
        throw new Error('Audio context not initialized');
      }
      
      if (this.context.state === 'suspended') {
        await this.context.resume();
      }
      
      this.mediaStream = this.context.createMediaStreamSource(stream);
      const bufferSize = 1024;
      const numberOfInputChannels = 1;
      const numberOfOutputChannels = 1;

      this.recorder = this.context.createScriptProcessor(
        bufferSize,
        numberOfInputChannels,
        numberOfOutputChannels
      );

      if (!this.recorder) return false;

      this.recorder.onaudioprocess = (e: any) => {
        if (!this.ggwave || !this.instance) {
          console.error('S3L SDK: Audio processing failed: ggwave or instance not initialized');
          return;
        }
        
        const sourceBuf = e.inputBuffer.getChannelData(0);
        const res = this.ggwave.decode(
          this.instance,
          convertTypedArray(new Float32Array(sourceBuf), Int8Array)
        );

        if (res && res.length > 0) {
          const text = new TextDecoder("utf-8").decode(res);
          
          // Parse ID from text and ignore messages from self
          if (text.startsWith(`${this.userId}$`)) {
            console.log("S3L SDK: Ignoring message from self", text);
            return;
          }
          
          // Remove any ID prefix if present
          const cleanMessage = text.includes('$') ? text.split('$').slice(1).join('$') : text;
          
          this.processReceivedMessage(cleanMessage);
        }
      };

      if (this.mediaStream && this.recorder) {
        this.mediaStream.connect(this.recorder);
        this.recorder.connect(this.context.destination);
      }

      this.isRecording = true;
      this.emit('connectionStateChanged', true);
      console.log('S3L SDK: Voice adapter listening started');
      return true;
    } catch (err) {
      console.error('S3L SDK: Recording error', err);
      this.emit('error', err instanceof Error ? err : new Error(String(err)));
      return false;
    }
  }

  /**
   * 오디오 녹음 중지
   */
  public async stopListening(): Promise<void> {
    if (!this.isRecording) return;
    
    // 브라우저 환경이 아닌 경우 모의 구현만 제공
    if (!this.isBrowser) {
      console.log('S3L SDK: Mock voice listening stopped in non-browser environment');
      this.isRecording = false;
      this.emit('connectionStateChanged', false);
      return;
    }

    if (this.recorder && this.context) {
      this.recorder.disconnect(this.context.destination);
      if (this.mediaStream) this.mediaStream.disconnect(this.recorder);
      this.recorder = null;
    }

    // Stop all tracks in the media stream
    if (this.mediaStreamInstance) {
      this.mediaStreamInstance.getTracks().forEach((track: any) => track.stop());
      this.mediaStreamInstance = null;
    }
    
    this.mediaStream = null;
    this.isRecording = false;
    this.emit('connectionStateChanged', false);
    console.log('S3L SDK: Voice adapter listening stopped');
  }

  /**
   * 분석기 노드 생성 (시각화 등에 활용)
   */
  public createAnalyserNode(): any {
    if (!this.isBrowser || !this.context) return null;
    
    if (!this.analyserNode) {
      this.analyserNode = this.context.createAnalyser();
      if (this.analyserNode) {
        this.analyserNode.fftSize = 2048;
      }
    }
    
    return this.analyserNode;
  }

  /**
   * S3L JSON 메시지 전송
   */
  public async sendMessage(message: S3lJsonMessage | S3lJsonResponse | string): Promise<boolean> {
    try {
      // 브라우저 환경이 아닌 경우 모의 구현으로 메시지 처리
      if (!this.isBrowser) {
        console.log('S3L SDK: Mock sending voice message in non-browser environment');
        const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
        console.log(`S3L SDK: (Mock) Message content: ${messageStr.substring(0, 50)}${messageStr.length > 50 ? '...' : ''}`);
        
        // Node.js 환경에서 GGWave 직접 사용 (가능한 경우)
        if (typeof require !== 'undefined') {
          try {
            // ggwave 초기화
            if (!this.ggwave) {
              try {
                // Node.js에서 사용 가능한 ggwave 모듈 확인
                const ggwaveModule = require('ggwave');
                this.ggwave = ggwaveModule;
                if (this.ggwave) {
                  const parameters = this.ggwave.getDefaultParameters();
                  parameters.sampleRateInp = 48000;
                  parameters.sampleRateOut = 48000;
                  parameters.soundMarkerThreshold = 4;
                  this.instance = this.ggwave.init(parameters);
                  console.log('S3L SDK: GGWave initialized in Node.js environment');
                }
              } catch (err) {
                console.error('Failed to load ggwave in Node.js:', err);
                return true; // 계속 진행
              }
            }
            
            if (this.ggwave && this.instance) {
              // 오디오 인코딩
              const protocol = this.ggwave.ProtocolId.GGWAVE_PROTOCOL_AUDIBLE_FAST;
              const audioData = this.ggwave.encode(
                this.instance,
                `${this.userId}$${messageStr}`,
                protocol,
                10
              );
              
              // WAV 파일로 저장
              if (nodeWav) {
                this.saveAudioToWav(audioData);
              }
            }
          } catch (err) {
            console.error('Error creating audio in Node.js:', err);
          }
        }
        
        return true;
      }
      
      if (!await this.initAudio() || !this.context || !this.ggwave || !this.instance) {
        console.error('S3L SDK: Failed to send voice message: audio context or ggwave not initialized');
        return false;
      }
      
      // 메시지를 문자열로 변환
      const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
      
      // 메시지가 매우 길 경우 청크로 분할
      if (messageStr.length > this.chunkSize) {
        const chunks = [];
        for (let i = 0; i < messageStr.length; i += this.chunkSize) {
          chunks.push(messageStr.substring(i, i + this.chunkSize));
        }
        
        // 청크를 순차적으로 전송
        for (let i = 0; i < chunks.length; i++) {
          const chunkMarker = `[${i+1}/${chunks.length}]`;
          await this.sendAudioMessage(`${this.userId}$${chunkMarker}${chunks[i]}`, true);
          
          // 청크 사이에 약간의 지연을 두어 수신측이 처리할 시간을 줌
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } else {
        // 짧은 메시지는 그대로 전송
        await this.sendAudioMessage(`${this.userId}$${messageStr}`, false);
      }
      
      return true;
    } catch (error) {
      console.error('S3L SDK: Failed to send voice message:', error);
      this.emit('error', error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  /**
   * 오디오 데이터를 WAV 파일로 저장
   */
  private saveAudioToWav(audioData: Int16Array): void {
    try {
      if (!nodeWav) {
        console.error('node-wav module not available');
        return;
      }
      
      // Int16Array를 Float32Array로 변환
      const floatData = new Float32Array(audioData.length);
      for (let i = 0; i < audioData.length; i++) {
        floatData[i] = audioData[i] / 32768.0; // 16-bit PCM normalization
      }
      
      // WAV 파일 생성
      const wavData = nodeWav.encode([floatData], {
        sampleRate: 48000,
        float: true,
        bitDepth: 32
      });
      
      // 파일 저장 디렉토리 확인 및 생성
      const dir = path.join(process.cwd(), 'audio-output');
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      // 파일명 생성 (타임스탬프 포함)
      const timestamp = Date.now();
      const filename = path.join(dir, `s3l-audio-${timestamp}.wav`);
      
      // 파일 저장
      fs.writeFileSync(filename, wavData);
      console.log(`S3L SDK: Audio saved to ${filename}`);
      
      // 오디오 재생 (가능한 경우)
      this.playAudioFile(filename);
      
      return;
    } catch (err) {
      console.error('Failed to save audio to WAV:', err);
    }
  }

  /**
   * 저장된 오디오 파일 재생
   */
  private playAudioFile(filename: string): void {
    try {
      if (playSound) {
        console.log('S3L SDK: Playing audio with play-sound...');
        playSound.play(filename, (err: any) => {
          if (err) console.error('Error playing audio:', err);
        });
      } else if (Speaker) {
        console.log('S3L SDK: Playing audio with speaker...');
        try {
          // 파일에서 데이터 읽기
          const wavData = fs.readFileSync(filename);
          const wavDecoded = nodeWav.decode(wavData);
          
          // Speaker 설정
          const speaker = new Speaker({
            channels: wavDecoded.channelData.length,
            bitDepth: 32,
            sampleRate: wavDecoded.sampleRate,
            float: true
          });
          
          // PCM 데이터 생성 및 재생
          const floatData = wavDecoded.channelData[0];
          const bufferData = Buffer.from(floatData.buffer);
          speaker.write(bufferData);
          speaker.end();
        } catch (speakerErr) {
          console.error('Error using speaker:', speakerErr);
        }
      } else {
        console.log('S3L SDK: No audio playback method available');
      }
    } catch (err) {
      console.error('Error playing audio file:', err);
    }
  }

  /**
   * 수신된 메시지 처리
   */
  private processReceivedMessage(text: string): void {
    // 청크 메시지 처리
    if (text.startsWith('[') && text.includes('/')) {
      const prefixEnd = text.indexOf(']');
      if (prefixEnd > 0) {
        const prefix = text.substring(1, prefixEnd);
        const [current, total] = prefix.split('/').map(Number);
        
        // 청크 메시지 처리
        if (!isNaN(current) && !isNaN(total)) {
          const content = text.substring(prefixEnd + 1);
          this.messageBuffer += content;
          
          // 마지막 청크인 경우 전체 메시지 처리
          if (current === total) {
            const completeMessage = this.messageBuffer;
            this.messageBuffer = '';
            this.handleMessage(completeMessage);
          }
          return;
        }
      }
    }
    
    // 일반 메시지 처리
    this.handleMessage(text);
  }

  /**
   * 메시지 파싱 및 이벤트 발생
   */
  private handleMessage(messageText: string): void {
    try {
      // JSON 메시지 파싱 시도
      JSON.parse(messageText);
      // JSON 파싱 성공시 메시지 이벤트 발생
      this.emit('message', messageText, 'voice');
    } catch (error) {
      // JSON이 아닌 일반 텍스트인 경우도 메시지 이벤트 발생
      this.emit('message', messageText, 'voice');
    }
  }

  /**
   * 현재 녹음 상태 반환
   */
  public isListening(): boolean {
    return this.isRecording;
  }

  /**
   * AudioContext 반환
   */
  public getAudioContext(): any {
    return this.context;
  }

  /**
   * 오디오 메시지 전송 내부 구현
   */
  private async sendAudioMessage(message: string, fastest: boolean = false): Promise<boolean> {
    try {
      if (!this.context || !this.ggwave || !this.instance) {
        console.error('S3L SDK: Failed to send audio message: audio context or ggwave not initialized');
        return false;
      }

      const protocol = fastest 
        ? this.ggwave.ProtocolId.GGWAVE_PROTOCOL_AUDIBLE_FASTEST 
        : this.ggwave.ProtocolId.GGWAVE_PROTOCOL_AUDIBLE_FAST;
      
      const waveform = this.ggwave.encode(
        this.instance,
        message,
        protocol,
        10
      );

      const buf = convertTypedArray(waveform, Float32Array);
      const buffer = this.context.createBuffer(1, buf.length, this.context.sampleRate);
      buffer.getChannelData(0).set(buf);
      const source = this.context.createBufferSource();
      source.buffer = buffer;
      
      // If global analyser node exists, connect through it
      if (this.analyserNode) {
        source.connect(this.analyserNode);
        this.analyserNode.connect(this.context.destination);
      } else {
        source.connect(this.context.destination);
      }
      
      source.start(0);
      return true;
    } catch (error) {
      console.error('S3L SDK: Failed to send audio message:', error);
      this.emit('error', error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }
} 