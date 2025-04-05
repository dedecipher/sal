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
exports.SalClient = void 0;
const types_1 = require("../types");
const events_1 = require("events");
const codec_1 = require("./codec");
const bs58_1 = __importDefault(require("bs58"));
const nacl = __importStar(require("tweetnacl"));
/**
 * SalClient는 음성 기반 통신을 통해 SalHost와 통신하는 클라이언트입니다.
 */
class SalClient extends events_1.EventEmitter {
    constructor(config) {
        super();
        this.isConnected = false;
        this.currentHost = null;
        this.audioCodec = null;
        this.pendingRequests = new Map();
        // 콜백 함수
        this.onSuccessCallback = null;
        this.onFailureCallback = null;
        // 필수 설정 확인
        if (!config.cluster || !config.keyPair) {
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
     * 호스트에 연결합니다.
     */
    connect(host, phoneNumber) {
        this.currentHost = host;
        // 오디오 수신 시작
        this.initAudioCodec();
        // 연결 프로세스 시작
        this.performConnection(host, phoneNumber);
        return this;
    }
    /**
     * 성공 콜백을 설정합니다.
     */
    onSuccess(callback) {
        this.onSuccessCallback = callback;
        return this;
    }
    /**
     * 실패 콜백을 설정합니다.
     */
    onFailure(callback) {
        this.onFailureCallback = callback;
        return this;
    }
    /**
     * 연결된 호스트에 메시지를 전송합니다.
     */
    async send(message) {
        if (!this.isConnected) {
            throw new Error('호스트에 연결되지 않았습니다.');
        }
        if (!this.currentHost) {
            throw new Error('호스트가 지정되지 않았습니다.');
        }
        return this.sendTextMessage(message);
    }
    /**
     * 연결을 종료합니다.
     */
    async close() {
        if (!this.isConnected) {
            return;
        }
        if (this.audioCodec) {
            this.audioCodec.stopListening();
            this.audioCodec.dispose();
            this.audioCodec = null;
        }
        this.isConnected = false;
        this.currentHost = null;
        this.emit('disconnected');
        console.log('SAL 클라이언트 연결 종료');
    }
    /**
     * 오디오 코덱을 초기화합니다.
     */
    async initAudioCodec() {
        // 이미 초기화되어 있으면 리턴
        if (this.audioCodec) {
            return;
        }
        // 새 인스턴스 생성
        this.audioCodec = new codec_1.AudioCodec('CLIENT');
        // 메시지 핸들러 등록
        this.audioCodec.onMessage(this.handleAudioMessage.bind(this));
        // 오디오 수신 시작
        await this.audioCodec.startListening();
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
            const response = JSON.parse(event.message);
            // 응답 처리
            this.handleResponse(response);
        }
        catch (error) {
            console.error('오디오 메시지 처리 오류:', error);
        }
    }
    /**
     * 호스트와 연결을 수행합니다.
     */
    async performConnection(host, phoneNumber) {
        try {
            console.log(`${host}에 연결 중...`);
            // GM 메시지 헤더 생성
            const headers = {
                host,
                nonce: this.generateNonce(),
                publicKey: this.keypair.publicKey.toString()
            };
            if (phoneNumber) {
                headers.phone = phoneNumber;
            }
            // GM 메시지 본문
            const body = "HELLO";
            // GM 메시지 전송
            const response = await this.sendRequest(types_1.SalMethod.GM, headers, body);
            // 응답 확인
            if (response.status === 'ok') {
                this.isConnected = true;
                this.emit('connected', host);
                if (this.onSuccessCallback) {
                    this.onSuccessCallback();
                }
            }
            else {
                throw new Error(`연결 거부됨: ${JSON.stringify(response.msg.body)}`);
            }
        }
        catch (error) {
            console.error('연결 실패:', error);
            if (this.onFailureCallback) {
                this.onFailureCallback(error instanceof Error ? error : new Error(String(error)));
            }
            this.emit('error', error);
        }
    }
    /**
     * 텍스트 메시지를 전송합니다.
     */
    async sendTextMessage(message) {
        console.log(`${this.currentHost}에 텍스트 메시지 전송: ${message}`);
        const headers = {
            host: this.currentHost,
            nonce: this.generateNonce(),
            publicKey: this.keypair.publicKey.toString()
        };
        // 메시지 전송
        return this.sendRequest(types_1.SalMethod.MSG, headers, message);
    }
    /**
     * 요청을 전송합니다.
     */
    async sendRequest(method, headers, body) {
        if (!this.audioCodec) {
            await this.initAudioCodec();
            if (!this.audioCodec) {
                throw new Error('오디오 코덱을 초기화할 수 없습니다.');
            }
        }
        // 요청 생성
        const msg = { headers, body };
        const request = {
            method,
            sig: this.sign(JSON.stringify(msg)),
            msg
        };
        // 요청을 JSON 문자열로 변환
        const requestJson = JSON.stringify(request);
        return new Promise((resolve, reject) => {
            // 타임아웃 설정
            const timeoutId = setTimeout(() => {
                this.pendingRequests.delete(headers.nonce);
                reject(new Error('응답 타임아웃'));
            }, 10000);
            // 요청 등록
            this.pendingRequests.set(headers.nonce, {
                resolve: (response) => {
                    clearTimeout(timeoutId);
                    resolve(response);
                },
                reject
            });
            // 오디오로 전송
            this.audioCodec.sendMessage(requestJson, true)
                .catch(error => {
                clearTimeout(timeoutId);
                this.pendingRequests.delete(headers.nonce);
                reject(error);
            });
        });
    }
    /**
     * 응답을 처리합니다.
     */
    handleResponse(response) {
        // 응답의 nonce 추출
        const nonce = response.msg.headers.nonce;
        // 보류 중인 요청 확인
        const pendingRequest = this.pendingRequests.get(nonce);
        if (pendingRequest) {
            // 응답 제공
            pendingRequest.resolve(response);
            this.pendingRequests.delete(nonce);
        }
        else {
            console.warn('알 수 없는 응답 무시:', nonce);
        }
    }
    /**
     * 랜덤 nonce를 생성합니다.
     */
    generateNonce() {
        const buffer = new Uint8Array(16);
        window.crypto.getRandomValues(buffer);
        return Array.from(buffer)
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    }
    /**
     * 메시지에 서명합니다.
     */
    sign(message) {
        try {
            const messageUint8 = new TextEncoder().encode(message);
            // @solana/web3.js의 sign 함수 사용
            const signature = nacl.sign.detached(messageUint8, this.keypair.secretKey);
            return bs58_1.default.encode(signature);
        }
        catch (error) {
            console.error('서명 생성 오류:', error);
            return 'invalid-signature';
        }
    }
}
exports.SalClient = SalClient;
