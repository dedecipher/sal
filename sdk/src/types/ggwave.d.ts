/**
 * ggwave 오디오 인코딩 라이브러리를 위한 타입 정의
 */

declare global {
  interface Window {
    ggwave_factory: () => Promise<GGWave>;
  }
}

/**
 * ggwave 오디오 인코딩 파라미터
 */
export interface GGWaveParameters {
  sampleRateInp: number;
  sampleRateOut: number;
  soundMarkerThreshold: number;
  [key: string]: any;
}

/**
 * ggwave 프로토콜 ID
 */
export enum GGWaveProtocolId {
  GGWAVE_PROTOCOL_AUDIBLE_NORMAL = 1,
  GGWAVE_PROTOCOL_AUDIBLE_FAST = 2,
  GGWAVE_PROTOCOL_AUDIBLE_FASTEST = 3,
  GGWAVE_PROTOCOL_ULTRASOUND_NORMAL = 4,
  GGWAVE_PROTOCOL_ULTRASOUND_FAST = 5,
  GGWAVE_PROTOCOL_ULTRASOUND_FASTEST = 6
}

/**
 * ggwave 라이브러리 인터페이스
 */
export interface GGWave {
  getDefaultParameters(): GGWaveParameters;
  init(parameters: GGWaveParameters): number;
  encode(instance: number, message: string, protocol: number, volume: number): any;
  decode(instance: number, samples: Int8Array): Uint8Array | null;
  ProtocolId: {
    GGWAVE_PROTOCOL_AUDIBLE_NORMAL: number;
    GGWAVE_PROTOCOL_AUDIBLE_FAST: number;
    GGWAVE_PROTOCOL_AUDIBLE_FASTEST: number;
    GGWAVE_PROTOCOL_ULTRASOUND_NORMAL: number;
    GGWAVE_PROTOCOL_ULTRASOUND_FAST: number;
    GGWAVE_PROTOCOL_ULTRASOUND_FASTEST: number;
    [key: string]: number;
  };
} 