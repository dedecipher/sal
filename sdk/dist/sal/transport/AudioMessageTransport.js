"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AudioMessageTransport = void 0;
const events_1 = require("events");
/**
 * 오디오 기반 메시지 전송을 위한 클래스
 * 웹 오디오 API와 ggwave 라이브러리를 사용하여 오디오로 메시지를 인코딩/디코딩합니다.
 */
class AudioMessageTransport {
    /**
     * AudioMessageTransport 생성자
     * @param config 설정 객체
     */
    constructor(config = {}) {
        this.context = null;
        this.ggwave = null;
        this.instance = null;
        this.isRecording = false;
        this.mediaStream = null;
        this.recorder = null;
        this.messageHandler = null;
        this.initialized = false;
        this.logDiv = null;
        // 수신된 청크를 저장하는 버퍼
        this.receivedChunks = [];
        // 메시지 구분자
        this.MESSAGE_MARKER = '|@|';
        // 청크 크기 (바이트)
        this.CHUNK_SIZE = 100;
        this.name = config.name || 'AudioTransport';
        this.emitter = new events_1.EventEmitter();
        // 로그 기록용 div 요소
        const logElementId = config.logElement || `${this.name.toLowerCase()}-log`;
        this.logDiv = document.getElementById(logElementId);
        // 이벤트 핸들러 등록
        this.emitter.on('message_received', (message) => {
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
    log(message, type = 'info') {
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
    convertTypedArray(src, type) {
        const buffer = new ArrayBuffer(src.byteLength);
        new src.constructor(buffer).set(src);
        return new type(buffer);
    }
    /**
     * ggwave 및 오디오 컨텍스트 초기화
     * @returns 초기화 성공 여부
     */
    async initialize() {
        if (this.initialized)
            return true;
        try {
            if (typeof window === 'undefined') {
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
            this.ggwave = await window.ggwave_factory();
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
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.log(`초기화 오류: ${errorMessage}`, 'error');
            console.error(`[${this.name}] 초기화 오류:`, error);
            return false;
        }
    }
    /**
     * 메시지 송신 메서드 - 청킹 기능 추가
     * @param message 전송할 메시지
     * @returns 전송 완료 Promise
     */
    async sendMessage(message) {
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
            console.log(`[${this.name}] 메시지 출력을 위해 마이크 감지 완전 중지`);
            this.log('메시지 전송 중 마이크 감지 중지', 'info');
            await this.stopListening(); // 마이크 완전히 해제
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
            // 메시지 길이 제한 - 너무 긴 메시지는 오디오로 전송하기 어려움
            if (messageStr.length > 5000) {
                console.warn(`[${this.name}] 메시지가 매우 깁니다(${messageStr.length}자). 처리 시간이 오래 걸릴 수 있습니다.`);
            }
            // 유효한 문자열인지 확인 (일부 특수문자나 이진 데이터가 들어오면 문제 발생 가능)
            const validRegex = /^[\x20-\x7E\uAC00-\uD7A3\u3130-\u318F]+$/; // ASCII 가능 문자 및 한글
            if (!validRegex.test(messageStr)) {
                console.warn(`[${this.name}] 메시지에 지원되지 않는 문자가 포함되어 있습니다. 필터링합니다.`);
                // 지원되지 않는 문자는 '?' 로 대체
                messageStr = messageStr.replace(/[^\x20-\x7E\uAC00-\uD7A3\u3130-\u318F]/g, '?');
            }
            // 메시지에 시작/끝 마커 추가
            const markedMessage = `${this.MESSAGE_MARKER}${messageStr}${this.MESSAGE_MARKER}`;
            // 메시지 크기 정보 표시 (마커 포함)
            const messageBytesUTF8 = new TextEncoder().encode(markedMessage).length;
            console.log(`[${this.name}] 마커 포함 메시지 크기: ${markedMessage.length}자 / ${messageBytesUTF8}바이트(UTF-8)`);
            // 메시지를 청크로 분할
            const messageBytes = new TextEncoder().encode(markedMessage);
            const totalChunks = Math.ceil(messageBytes.length / this.CHUNK_SIZE);
            console.log(`[${this.name}] 메시지를 ${totalChunks}개 청크로 분할하여 전송합니다. (청크 크기: ${this.CHUNK_SIZE}바이트)`);
            this.log(`메시지 전송 시작: 총 ${totalChunks}개 청크 (${messageBytesUTF8}바이트)`, 'request');
            // 각 청크 전송
            for (let i = 0; i < totalChunks; i++) {
                const start = i * this.CHUNK_SIZE;
                const end = Math.min(start + this.CHUNK_SIZE, messageBytes.length);
                const chunkBytes = messageBytes.slice(start, end);
                const chunkStr = new TextDecoder().decode(chunkBytes);
                console.log(`[${this.name}] 청크 #${i + 1}/${totalChunks} 전송 중: ${chunkBytes.length}바이트`);
                this.log(`청크 ${i + 1}/${totalChunks} 전송 중...`, 'request');
                // 각 청크 인코딩 및 전송
                await this.sendChunk(chunkStr, i + 1, totalChunks);
                // 청크 사이에 짧은 대기 (다음 청크가 있는 경우)
                if (i < totalChunks - 1) {
                    await new Promise(resolve => setTimeout(resolve, 200)); // 청크 간 대기 시간 (200ms)
                }
            }
            this.log(`모든 청크 전송 완료 (${totalChunks}개)`, 'request');
            console.log(`[${this.name}] 모든 청크 전송 완료`);
            // 이전에 녹음 중이었다면 녹음 재개
            if (wasRecording) {
                console.log(`[${this.name}] 메시지 출력 완료 후 마이크 감지 재개`);
                this.log('메시지 전송 완료 - 마이크 감지 재개 준비 중', 'info');
                // 약간의 딜레이를 두고 재개 (1000ms로 증가 - 오디오 출력 끝과 새 마이크 감지 시작 사이 충분한 간격)
                await new Promise(resolve => setTimeout(resolve, 1000));
                try {
                    // 새로운 마이크 스트림 생성 및 녹음 시작
                    const success = await this.startListening();
                    if (success) {
                        console.log(`[${this.name}] 새 마이크 스트림으로 감지 재개 성공`);
                        this.log('마이크 감지 재개됨', 'info');
                    }
                    else {
                        console.error(`[${this.name}] 마이크 감지 재개 실패`);
                        this.log('마이크 감지 재개 실패', 'error');
                    }
                }
                catch (resumeError) {
                    console.error(`[${this.name}] 마이크 감지 재개 중 오류 발생:`, resumeError);
                    this.log('마이크 감지 재개 중 오류 발생', 'error');
                }
            }
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.log(`메시지 전송 실패: ${errorMessage}`, 'error');
            console.error(`[${this.name}] 메시지 전송 실패:`, error);
            // 오류 발생 시에도 녹음 상태 복원 시도
            if (wasRecording && !this.isRecording) {
                try {
                    console.log(`[${this.name}] 오류 발생 후 마이크 감지 재개 시도`);
                    await this.startListening();
                }
                catch (resumeError) {
                    console.error(`[${this.name}] 오류 후 마이크 감지 재개 실패:`, resumeError);
                }
            }
            throw error;
        }
    }
    /**
     * 단일 청크 전송 (내부 메서드)
     * @param chunk 전송할 청크 문자열
     * @param chunkNumber 현재 청크 번호
     * @param totalChunks 총 청크 개수
     */
    async sendChunk(chunk, chunkNumber, totalChunks) {
        try {
            // ggwave 인스턴스 검증
            if (!this.ggwave) {
                throw new Error('ggwave가 초기화되지 않았습니다.');
            }
            if (!this.instance || this.instance === 0) {
                throw new Error('ggwave 인스턴스가 유효하지 않습니다. 재초기화가 필요합니다.');
            }
            // 프로토콜 확인 및 선택 (빠른 프로토콜 사용)
            let protocol;
            if (this.ggwave.ProtocolId && this.ggwave.ProtocolId.GGWAVE_PROTOCOL_AUDIBLE_FAST !== undefined) {
                protocol = this.ggwave.ProtocolId.GGWAVE_PROTOCOL_AUDIBLE_FAST;
            }
            else {
                // 프로토콜을 찾을 수 없으면 기본값 사용
                protocol = 2; // GGWAVE_PROTOCOL_AUDIBLE_FAST는 보통 2
            }
            // 볼륨 설정
            const volume = 10; // 볼륨 최소화 (15 -> 10)
            console.log(`[${this.name}] 청크 #${chunkNumber} 인코딩 시작 (${chunk.length}자)`);
            // ggwave로 청크 인코딩
            const waveform = this.ggwave.encode(this.instance, chunk, protocol, volume);
            if (!waveform || waveform.length === 0) {
                throw new Error('오디오 인코딩 실패: 빈 파형이 반환되었습니다.');
            }
            console.log(`[${this.name}] 청크 #${chunkNumber} 인코딩 완료, 파형 길이: ${waveform.length} 샘플`);
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
            console.log(`[${this.name}] 청크 #${chunkNumber} 오디오 버퍼 생성됨, 길이: ${duration.toFixed(2)}초`);
            // 오디오 소스 생성 및 출력 - 직접 재생
            const source = this.context.createBufferSource();
            source.buffer = buffer;
            // 직접 연결: source -> destination (게인 노드 제거)
            source.connect(this.context.destination);
            // 재생 시작
            source.start(0);
            console.log(`[${this.name}] 청크 #${chunkNumber} 오디오 재생 시작`);
            // 전송이 완료될 때까지 기다림 (인코딩된 오디오 길이 + 여유 시간)
            return new Promise(resolve => {
                // 예상 재생 시간 + 추가 여유 시간 (초)
                const bufferDuration = duration * 1000; // 밀리초로 변환
                const extraTime = Math.max(300, duration * 1000 * 0.2); // 여유 시간 (최소 300ms, 또는 재생 시간의 20%)
                const waitTime = bufferDuration + extraTime;
                console.log(`[${this.name}] 청크 #${chunkNumber} ${waitTime.toFixed(0)}ms 후 재생 완료 예정`);
                setTimeout(() => {
                    console.log(`[${this.name}] 청크 #${chunkNumber} 오디오 재생 완료`);
                    resolve();
                }, waitTime);
            });
        }
        catch (encodeError) {
            const errorMessage = encodeError instanceof Error ? encodeError.message : String(encodeError);
            console.error(`[${this.name}] 청크 #${chunkNumber} 인코딩 오류 발생:`, encodeError);
            this.log(`청크 #${chunkNumber} 인코딩 오류: ${errorMessage}`, 'error');
            throw new Error(`청크 #${chunkNumber} 오디오 인코딩 실패: ${errorMessage}`);
        }
    }
    /**
     * 메시지 수신 핸들러 등록
     * @param handler 메시지 수신 핸들러
     */
    onMessage(handler) {
        this.messageHandler = handler;
    }
    /**
     * 녹음 시작 및 메시지 수신 대기
     * @returns 녹음 시작 성공 여부
     */
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
        // 청크 버퍼 초기화
        this.receivedChunks = [];
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
            // 마이크 스트림 새로 획득
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
                    lastLog = now;
                    console.log(`[${this.name}] 오디오 처리 중... 신호 강도: ${signalStrength.toFixed(5)}`);
                }
                try {
                    // ggwave 인스턴스 확인
                    if (!this.instance || typeof this.instance !== 'number' || !this.ggwave) {
                        console.error(`[${this.name}] ggwave 인스턴스가 유효하지 않습니다.`);
                        return;
                    }
                    // 디코딩 시도
                    try {
                        // Float32Array를 Int8Array로 변환
                        const result = this.ggwave.decode(this.instance, this.convertTypedArray(new Float32Array(sourceBuf), Int8Array));
                        // 결과 출력
                        if (result && result.byteLength > 0) {
                            // 문자열로 변환
                            const text = new TextDecoder("utf-8").decode(result);
                            console.log(`[${this.name}] 청크 수신: ${result.byteLength}바이트, "${text}"`);
                            // 청크를 수신 버퍼에 추가
                            this.receivedChunks.push(text);
                            // 수신된 청크들을 결합하여 완전한 메시지가 있는지 확인
                            const combinedMessage = this.receivedChunks.join('');
                            // 마커로 둘러싸인 메시지 검색
                            const markerStart = combinedMessage.indexOf(this.MESSAGE_MARKER);
                            const markerEnd = combinedMessage.indexOf(this.MESSAGE_MARKER, markerStart + this.MESSAGE_MARKER.length);
                            // 시작과 끝 마커가 모두 발견되면 완전한 메시지가 있음
                            if (markerStart !== -1 && markerEnd !== -1) {
                                // 마커 사이의 메시지 추출
                                const completeMessage = combinedMessage.substring(markerStart + this.MESSAGE_MARKER.length, markerEnd);
                                console.log(`[${this.name}] 완전한 메시지 수신: ${completeMessage.length}자`);
                                this.log(`완전한 메시지 수신됨 (${completeMessage.length}자)`, 'response');
                                // 메시지 이벤트 발생
                                this.emitter.emit('message_received', completeMessage);
                                // 메시지 핸들러가 있으면 호출
                                if (this.messageHandler) {
                                    this.messageHandler(completeMessage);
                                }
                                // 처리된 메시지는 제거하고 나머지 데이터는 유지
                                const remainingMessage = combinedMessage.substring(markerEnd + this.MESSAGE_MARKER.length);
                                this.receivedChunks = remainingMessage ? [remainingMessage] : [];
                                console.log(`[${this.name}] 버퍼 정리됨, 남은 데이터: ${remainingMessage.length}자`);
                            }
                        }
                    }
                    catch (decodeErr) {
                        console.error(`[${this.name}] ggwave.decode 오류:`, decodeErr);
                    }
                }
                catch (err) {
                    console.error(`[${this.name}] 디코딩 중 오류:`, err);
                }
            };
            // 노드 연결
            mediaStreamSource.connect(this.recorder);
            this.recorder.connect(this.context.destination);
            this.log('마이크 녹음 및 메시지 수신 대기 시작', 'info');
            this.isRecording = true;
            return true;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.log(`녹음 시작 실패: ${errorMessage}`, 'error');
            console.error(`[${this.name}] 녹음 시작 실패:`, error);
            return false;
        }
    }
    /**
     * 녹음 중지 (메시지 수신 대기 중지)
     */
    stopListening() {
        if (!this.isRecording) {
            this.log('녹음 중이 아닙니다.', 'info');
            return Promise.resolve();
        }
        try {
            this.log('메시지 수신 대기 중지...', 'info');
            // 리소스 정리
            if (this.recorder) {
                console.log(`[${this.name}] 스크립트 프로세서 노드 연결 해제`);
                this.recorder.disconnect();
                this.recorder.onaudioprocess = null; // 이벤트 핸들러 명시적 제거
                this.recorder = null;
            }
            if (this.mediaStream) {
                console.log(`[${this.name}] 모든 마이크 트랙 중지 및 해제`);
                // 모든 트랙에 대해 명시적으로 중지
                const tracks = this.mediaStream.getTracks();
                tracks.forEach(track => {
                    console.log(`[${this.name}] 마이크 트랙 중지: ${track.kind} (${track.label})`);
                    track.stop();
                    // 선택적: 트랙 활성화 상태 로깅
                    console.log(`[${this.name}] 트랙 활성화 상태: ${track.enabled}`);
                });
                this.mediaStream = null;
            }
            this.isRecording = false;
            console.log(`[${this.name}] 마이크 녹음 중지 완료`);
            return Promise.resolve();
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.log(`녹음 중지 실패: ${errorMessage}`, 'error');
            console.error(`[${this.name}] 녹음 중지 실패:`, error);
            return Promise.reject(error);
        }
    }
    /**
     * 연결 시작 (MessageTransport 인터페이스 구현)
     * @returns 연결 성공 여부
     */
    async connect() {
        const success = await this.startListening();
        return success;
    }
    /**
     * 연결 해제 (MessageTransport 인터페이스 구현)
     * @returns Promise<void>
     */
    async disconnect() {
        this.stopListening();
        return Promise.resolve();
    }
}
exports.AudioMessageTransport = AudioMessageTransport;
