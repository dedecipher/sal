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
const bs58_1 = __importDefault(require("bs58"));
const web3_js_1 = require("@solana/web3.js");
const nacl = __importStar(require("tweetnacl"));
/**
 * SalClient는 SalHost와 통신하는 클라이언트입니다.
 */
class SalClient extends events_1.EventEmitter {
    constructor(config, messageTransport) {
        super();
        this.isConnected = false;
        this.currentHost = null;
        this.messageTransport = null;
        this.pendingRequests = new Map();
        // 콜백 함수
        this.onSuccessCallback = null;
        this.onFailureCallback = null;
        // 필수 설정 확인
        if (!config.cluster || !config.keyPair) {
            throw new Error('필수 설정 매개변수가 누락되었습니다.');
        }
        this.cfg = { ...config };
        // 키페어 생성
        this.keypair = config.keyPair;
        // Solana 연결 설정
        this.connection = new web3_js_1.Connection(config.cluster);
        // 메시지 전송 인터페이스 설정
        this.messageTransport = messageTransport;
        // 메시지 핸들러 등록
        this.messageTransport.onMessage(this.handleIncomingMessage.bind(this));
        if (config.testMode) {
            this.isConnected = true;
        }
    }
    /**
     * 호스트에 연결합니다.
     */
    connect(host, phoneNumber) {
        this.currentHost = host;
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
        if (this.messageTransport) {
            await this.messageTransport.disconnect();
        }
        this.isConnected = false;
        this.currentHost = null;
        this.emit('disconnected');
    }
    /**
     * 수신 메시지를 처리합니다.
     */
    handleIncomingMessage(messageStr) {
        try {
            // JSON 파싱 시도
            const response = JSON.parse(messageStr);
            // 응답 처리
            this.handleResponse(response);
        }
        catch (error) {
            this.emit('error', new Error(`메시지 처리 오류: ${error}`));
        }
    }
    /**
     * 호스트와 연결을 수행합니다.
     */
    async performConnection(host, phoneNumber) {
        try {
            // 전송 계층 연결
            if (this.messageTransport) {
                await this.messageTransport.connect();
            }
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
            console.log(`연결 응답: ${JSON.stringify(response)}`);
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
        if (!this.messageTransport) {
            throw new Error('메시지 전송 인터페이스가 설정되지 않았습니다.');
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
            }, 1000000);
            // 요청 등록
            this.pendingRequests.set(headers.nonce, {
                resolve: (response) => {
                    clearTimeout(timeoutId);
                    resolve(response);
                },
                reject
            });
            // 메시지 전송
            this.messageTransport.sendMessage(requestJson)
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
    }
    /**
     * 랜덤 nonce를 생성합니다.
     */
    generateNonce() {
        // 랜덤한 16바이트 버퍼 생성
        // const buffer = new Uint8Array(16);
        // // 각 바이트에 랜덤값 할당 (브라우저 dependent 코드 제거)
        // for (let i = 0; i < buffer.length; i++) {
        //   buffer[i] = Math.floor(Math.random() * 256);
        // }
        // return Array.from(buffer)
        //   .map(b => b.toString(16).padStart(2, '0'))
        //   .join('');
        return "1";
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
            return 'invalid-signature';
        }
    }
    /**
     * SOL 전송 트랜잭션을 생성하고 직렬화합니다.
     * @param amount SOL 전송 금액
     * @param memo 메모
     * @param recipient 수신자 주소
     * @returns 직렬화된 트랜잭션 문자열
     */
    async createSolTransaction(amount, memo, recipient) {
        if (!this.isConnected) {
            throw new Error('호스트에 연결되지 않았습니다.');
        }
        try {
            if (!recipient) {
                if (!this.currentHost) {
                    throw new Error('호스트가 지정되지 않았습니다.');
                }
                recipient = this.currentHost;
            }
            // SOL을 lamports로 변환 (1 SOL = 10^9 lamports)
            const lamports = amount * web3_js_1.LAMPORTS_PER_SOL;
            // 발신자 및 수신자의 PublicKey
            const senderPubkey = this.keypair.publicKey;
            const recipientPubkey = new web3_js_1.PublicKey(recipient);
            const memoInstruction = new web3_js_1.TransactionInstruction({
                keys: [{ pubkey: recipientPubkey, isSigner: true, isWritable: true }],
                data: Buffer.from(memo, "utf-8"), // Memo message
                programId: new web3_js_1.PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"), // Memo program
            });
            const transferInstruction = web3_js_1.SystemProgram.transfer({
                fromPubkey: senderPubkey,
                toPubkey: recipientPubkey,
                lamports: lamports
            });
            const { blockhash } = await this.connection.getLatestBlockhash();
            const messageV0 = new web3_js_1.TransactionMessage({
                payerKey: senderPubkey,
                recentBlockhash: blockhash,
                instructions: [memoInstruction, transferInstruction],
            }).compileToV0Message();
            let versionedTransaction = new web3_js_1.VersionedTransaction(messageV0);
            versionedTransaction.sign([this.keypair]);
            const balance = await this.connection.getBalance(senderPubkey);
            console.log('senderPubkey: ', senderPubkey, 'balance: ', balance);
            // 트랜잭션 직렬화
            const serializedTransaction = bs58_1.default.encode(versionedTransaction.serialize());
            return serializedTransaction;
        }
        catch (error) {
            throw new Error(`SOL 트랜잭션 생성 오류: ${error}`);
        }
    }
    /**
     * 트랜잭션을 호스트로 전송합니다.
     */
    async sendTransaction(serializedTransaction) {
        if (!this.isConnected || !this.currentHost) {
            throw new Error('호스트에 연결되지 않았습니다.');
        }
        const headers = {
            host: this.currentHost,
            nonce: this.generateNonce(),
            publicKey: this.keypair.publicKey.toString()
        };
        // 트랜잭션 전송 - 호스트가 메모 명령어에 서명하고 처리합니다
        const response = await this.sendRequest(types_1.SalMethod.TX, headers, serializedTransaction);
        if (response.status === 'ok' && response.msg.body.signature) {
            return response.msg.body.signature;
        }
        else {
            throw new Error(`트랜잭션 전송 실패: ${JSON.stringify(response.msg.body)}`);
        }
    }
}
exports.SalClient = SalClient;
