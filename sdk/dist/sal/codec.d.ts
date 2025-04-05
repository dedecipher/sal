/**
 * 오디오 인코딩/디코딩을 위한 모듈
 * ggwave 라이브러리를 사용하여 메시지를 오디오로 변환하고, 오디오를 메시지로 변환하는 기능을 제공합니다.
 */
import { EventEmitter } from 'events';
export interface AudioEvent {
    message: string;
    source: 'self' | 'external';
}
export type AudioEventListener = (event: AudioEvent) => void;
export declare class AudioCodec extends EventEmitter {
    private context;
    private ggwave;
    private instance;
    private mediaStreamInstance;
    private mediaStream;
    private recorder;
    private isRecording;
    private userId;
    constructor(userId?: string);
    /**
     * 오디오 시스템을 초기화합니다.
     */
    init(): Promise<boolean>;
    /**
     * 마이크를 사용하여 오디오 수신을 시작합니다.
     */
    startListening(): Promise<boolean>;
    /**
     * 오디오 수신을 중지합니다.
     */
    stopListening(): void;
    /**
     * 메시지를 오디오로 인코딩하여 재생합니다.
     */
    sendMessage(message: string, fastest?: boolean): Promise<boolean>;
    /**
     * 메시지 이벤트 리스너를 등록합니다.
     */
    onMessage(listener: AudioEventListener): () => void;
    /**
     * 리소스를 정리합니다.
     */
    dispose(): void;
}
