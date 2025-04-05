"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SalHost = void 0;
const types_1 = require("../types");
const events_1 = require("events");
const codec_1 = require("./codec");
const nacl = __importStar(require("tweetnacl"));
const bs58_1 = __importDefault(require("bs58"));
/**
 * SalHost는 음성 기반 통신을 통해 클라이언트와 통신하는 호스트를 구현합니다.
 */
class SalHost extends events_1.EventEmitter {
    constructor(config) {
        super();
        this.messageHandler = null;
        this.txHandler = null;
        this.audioCodec = null;
        this.clients = new Map();
        this.isRunning = false;
        this.seenNonces = new Set(); // 재전송 공격 방지
        // 필수 설정 확인
        if (!config.cluster || !config.phoneNumber || !config.host || !config.keyPair) {
            throw new Error('필수 설정 매개변수가 누락되었습니다.');
        }
        this.cfg = {
            ...config,
            modality: types_1.Modality.VOICE // VOICE 모드만 지원
        };
        // 키페어 생성
        this.keypair = config.keyPair;
    }
    /**
     * 호스트를 초기화합니다.
     */
    async init() {
        try {
            console.log(`${this.cfg.host}에 대한 SAL 호스트 초기화`);
            // 오디오 코덱 초기화
            this.audioCodec = new codec_1.AudioCodec('HOST');
            // 초기화 이벤트 발생
            this.emit('initialized');
        }
        catch (error) {
            console.error('SAL 호스트 초기화 실패:', error);
            this.emit('error', error);
            throw error;
        }
    }
    /**
     * 메시지 및 트랜잭션 핸들러를 등록합니다.
     */
    register(handlers) {
        if (handlers.messageHandler) {
            this.messageHandler = handlers.messageHandler;
        }
        if (handlers.txHandler) {
            this.txHandler = handlers.txHandler;
        }
        return this;
    }
    /**
     * 서버를 시작하고 수신 연결을 기다립니다.
     */
    async run() {
        if (this.isRunning) {
            console.warn('SAL 호스트가 이미 실행 중입니다.');
            return;
        }
        try {
            if (!this.audioCodec) {
                throw new Error('오디오 코덱이 초기화되지 않았습니다.');
            }
            // 오디오 메시지 리스너 설정
            this.audioCodec.onMessage(this.handleAudioMessage.bind(this));
            // 오디오 수신 시작
            const success = await this.audioCodec.startListening();
            if (!success) {
                throw new Error('오디오 수신을 시작할 수 없습니다.');
            }
            this.isRunning = true;
            this.emit('running');
            console.log(`${this.cfg.host}에 대한 SAL 호스트가 실행 중입니다.`);
        }
        catch (error) {
            console.error('SAL 호스트 시작 실패:', error);
            this.emit('error', error);
            throw error;
        }
    }
    /**
     * 서버를 중지합니다.
     */
    async stop() {
        if (!this.isRunning) {
            return;
        }
        if (this.audioCodec) {
            this.audioCodec.stopListening();
            this.audioCodec.dispose();
            this.audioCodec = null;
        }
        this.isRunning = false;
        this.emit('stopped');
        console.log('SAL 호스트 중지됨');
    }
    /**
     * 오디오 메시지를 처리합니다.
     */
    handleAudioMessage(event) {
        try {
            if (event.source === 'self') {
                return; // 자신이 보낸 메시지는 무시
            }
            // JSON 파싱 시도
            const request = JSON.parse(event.message);
            // 요청 처리
            this.processIncomingRequest(request, 'audio-source');
        }
        catch (error) {
            console.error('오디오 메시지 처리 오류:', error);
        }
    }
    /**
     * 수신 요청을 처리합니다.
     */
    async processIncomingRequest(request, source) {
        try {
            // 메시지 구조 확인
            if (!request.sig || !request.msg || !request.msg.headers || request.msg.body === undefined) {
                console.warn('잘못된 SAL 메시지 형식, 무시');
                return;
            }
            // nonce 확인 (재전송 공격 방지)
            const nonce = request.msg.headers.nonce;
            if (this.seenNonces.has(nonce)) {
                console.warn('이미 처리된 nonce, 무시');
                return;
            }
            this.seenNonces.add(nonce);
            // 서명 확인
            const isValid = this.verifySignature(request.msg.headers.publicKey, JSON.stringify(request.msg), request.sig);
            if (!isValid) {
                console.warn('잘못된 메시지 서명, 거부');
                return;
            }
            // 메서드에 따라 처리
            switch (request.method) {
                case types_1.SalMethod.GM:
                    await this.handleGM(request.msg.headers, request.msg.body, source);
                    break;
                case types_1.SalMethod.MSG:
                    await this.handleMessage(request.msg.headers, request.msg.body, source);
                    break;
                case types_1.SalMethod.TX:
                    await this.handleTransaction(request.msg.headers, request.msg.body, source);
                    break;
                default:
                    console.warn(`알 수 없는 메서드: ${request.method}`);
            }
        }
        catch (error) {
            console.error('수신 요청 처리 오류:', error);
        }
    }
    /**
     * GM(인사) 메시지를 처리합니다.
     */
    async handleGM(headers, body, source) {
        console.log(`${source}에서 GM 메시지 수신:`, body);
        // 클라이언트 정보 저장
        this.clients.set(source, {
            publicKey: headers.publicKey
        });
        // 클라이언트 연결 이벤트 발생
        this.emit('client_connected', source);
        // 확인 응답 전송
        await this.sendResponse(headers, "WELCOME", source, 'ok');
    }
    /**
     * 일반 메시지를 처리합니다.
     */
    async handleMessage(headers, message, source) {
        if (this.messageHandler) {
            try {
                const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
                console.log(`메시지 수신: "${messageStr}" (발신자: ${source})`);
                await this.messageHandler(messageStr, source);
                // 확인 응답 전송
                await this.sendResponse(headers, { received: true }, source, 'ok');
            }
            catch (error) {
                console.error('메시지 핸들러 오류:', error);
                await this.sendResponse(headers, { error: String(error) }, source, 'error');
            }
        }
        else {
            console.warn('메시지 핸들러가 등록되지 않음');
            await this.sendResponse(headers, { error: 'No message handler' }, source, 'error');
        }
    }
    /**
     * 트랜잭션을 처리합니다.
     */
    async handleTransaction(headers, transaction, source) {
        if (this.txHandler) {
            try {
                const result = await this.txHandler(transaction);
                await this.sendResponse(headers, { signature: result }, source, 'ok');
            }
            catch (error) {
                console.error('트랜잭션 핸들러 오류:', error);
                await this.sendResponse(headers, { error: String(error) }, source, 'error');
            }
        }
        else {
            console.warn('트랜잭션 핸들러가 등록되지 않음');
            await this.sendResponse(headers, { error: 'No transaction handler' }, source, 'error');
        }
    }
    /**
     * 클라이언트에 응답을 전송합니다.
     */
    async sendResponse(requestHeaders, body, destination, status = 'ok') {
        if (!this.audioCodec) {
            console.error('오디오 코덱이 초기화되지 않았습니다.');
            return;
        }
        const headers = {
            ...requestHeaders,
            host: this.cfg.host,
            nonce: requestHeaders.nonce, // 요청의 nonce 재사용
            publicKey: this.keypair.publicKey.toString()
        };
        const msg = { headers, body };
        const response = {
            status,
            code: status === 'ok' ? 200 : 400,
            sig: this.sign(JSON.stringify(msg)),
            msg
        };
        // 응답을 JSON 문자열로 변환
        const responseJson = JSON.stringify(response);
        // 오디오로 전송
        await this.audioCodec.sendMessage(responseJson, true);
    }
    /**
     * 서명을 확인합니다.
     */
    verifySignature(publicKey, message, signature) {
        try {
            // 실제 구현에서는 공개 키로 서명 확인
            // 이 예제에서는 간단한 검증만 수행
            return true;
        }
        catch (error) {
            console.error('서명 확인 오류:', error);
            return false;
        }
    }
    /**
     * 메시지에 서명합니다.
     */
    sign(message) {
        try {
            const messageUint8 = new TextEncoder().encode(message);
            const signatureUint8 = nacl.sign.detached(messageUint8, this.keypair.secretKey);
            return bs58_1.default.encode(signatureUint8);
        }
        catch (error) {
            console.error('서명 생성 오류:', error);
            return 'invalid-signature';
        }
    }
}
exports.SalHost = SalHost;
