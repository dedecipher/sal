"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MockMessageTransport = void 0;
const events_1 = require("events");
/**
 * MockMessageTransport 클래스 - 메시지 전송을 모킹하고 요청/응답을 로깅합니다.
 */
class MockMessageTransport extends events_1.EventEmitter {
    constructor(name) {
        super();
        this.isListening = false;
        this.messageHandler = null;
        this.peerTransport = null;
        this.name = name;
    }
    // 다른 MockMessageTransport 인스턴스와 연결합니다
    connectToPeer(peer) {
        this.peerTransport = peer;
        peer.peerTransport = this;
        // console.log(`[${this.name}] 피어와 연결됨: ${peer.name}`);
    }
    // 메시지 전송 (피어에게 직접 전달)
    async sendMessage(message) {
        try {
            const parsedMessage = JSON.parse(message);
            if (parsedMessage.method) {
                // 요청인 경우
                // console.log(`[${this.name}] 요청 전송: ${parsedMessage.method} 메서드, nonce=${parsedMessage.msg.headers.nonce}`);
            }
            else if (parsedMessage.status) {
                // 응답인 경우
                // console.log(`[${this.name}] 응답 전송: ${parsedMessage.status}, code=${parsedMessage.code}, nonce=${parsedMessage.msg.headers.nonce}`);
            }
        }
        catch (error) {
            console.log(`[${this.name}] 메시지 전송: (파싱 불가능한 형식)`);
        }
        if (!this.peerTransport) {
            throw new Error('피어가 연결되지 않았습니다.');
        }
        // 잠시 지연 후 피어에게 메시지 전달 (비동기 시뮬레이션)
        setTimeout(() => {
            if (this.peerTransport && this.peerTransport.messageHandler) {
                this.peerTransport.messageHandler(message);
            }
        }, 10);
        return Promise.resolve();
    }
    // 메시지 수신 핸들러 등록
    onMessage(handler) {
        this.messageHandler = handler;
        // 원래 핸들러를 래핑하여 로깅 추가
        const wrappedHandler = (message) => {
            try {
                const parsedMessage = JSON.parse(message);
                if (parsedMessage.method) {
                    // 요청인 경우
                    // console.log(`[${this.name}] 요청 수신: ${parsedMessage.method} 메서드, nonce=${parsedMessage.msg.headers.nonce}`);
                }
                else if (parsedMessage.status) {
                    // 응답인 경우
                    // console.log(`[${this.name}] 응답 수신: ${parsedMessage.status}, code=${parsedMessage.code}, nonce=${parsedMessage.msg.headers.nonce}`);
                }
            }
            catch (error) {
                console.log(`[${this.name}] 메시지 수신: (파싱 불가능한 형식)`);
            }
            // 원래 핸들러 호출
            handler(message);
        };
        this.messageHandler = wrappedHandler;
    }
    // 클라이언트용 연결 메서드
    async connect() {
        // console.log(`[${this.name}] 연결 중...`);
        return Promise.resolve();
    }
    // 클라이언트용 연결 해제 메서드
    async disconnect() {
        // console.log(`[${this.name}] 연결 해제 중...`);
        return Promise.resolve();
    }
    // 호스트용 수신 시작 메서드
    async startListening() {
        // console.log(`[${this.name}] 수신 시작...`);
        this.isListening = true;
        return true;
    }
    // 호스트용 수신 중지 메서드
    stopListening() {
        // console.log(`[${this.name}] 수신 중지...`);
        this.isListening = false;
    }
}
exports.MockMessageTransport = MockMessageTransport;
