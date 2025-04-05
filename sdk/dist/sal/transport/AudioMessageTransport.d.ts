import { MessageTransport } from '../../types';
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
export declare class AudioMessageTransport implements MessageTransport {
    private name;
    private context;
    private ggwave;
    private instance;
    private isRecording;
    private mediaStream;
    private recorder;
    private emitter;
    private messageHandler;
    private initialized;
    private logDiv;
    private receivedChunks;
    private readonly MESSAGE_MARKER;
    private readonly CHUNK_SIZE;
    /**
     * AudioMessageTransport 생성자
     * @param config 설정 객체
     */
    constructor(config?: AudioMessageTransportConfig);
    /**
     * 로그 출력 함수
     * @param message 로그 메시지
     * @param type 로그 타입 (info, error, request, response)
     */
    private log;
    /**
     * 오디오 샘플 배열을 다른 타입으로 변환하는 헬퍼 함수
     */
    private convertTypedArray;
    /**
     * ggwave 및 오디오 컨텍스트 초기화
     * @returns 초기화 성공 여부
     */
    initialize(): Promise<boolean>;
    /**
     * 메시지 송신 메서드 - 청킹 기능 추가
     * @param message 전송할 메시지
     * @returns 전송 완료 Promise
     */
    sendMessage(message: string): Promise<void>;
    /**
     * 단일 청크 전송 (내부 메서드)
     * @param chunk 전송할 청크 문자열
     * @param chunkNumber 현재 청크 번호
     * @param totalChunks 총 청크 개수
     */
    private sendChunk;
    /**
     * 메시지 수신 핸들러 등록
     * @param handler 메시지 수신 핸들러
     */
    onMessage(handler: (message: string) => void): void;
    /**
     * 녹음 시작 및 메시지 수신 대기
     * @returns 녹음 시작 성공 여부
     */
    startListening(): Promise<boolean>;
    /**
     * 녹음 중지 (메시지 수신 대기 중지)
     */
    stopListening(): Promise<void>;
    /**
     * 연결 시작 (MessageTransport 인터페이스 구현)
     * @returns 연결 성공 여부
     */
    connect(): Promise<boolean>;
    /**
     * 연결 해제 (MessageTransport 인터페이스 구현)
     * @returns Promise<void>
     */
    disconnect(): Promise<void>;
}
