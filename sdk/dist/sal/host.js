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
const nacl = __importStar(require("tweetnacl"));
const bs58_1 = __importDefault(require("bs58"));
const web3_js_1 = require("@solana/web3.js");
/**
 * SalHost는 클라이언트와 통신하는 호스트를 구현합니다.
 */
class SalHost extends events_1.EventEmitter {
    constructor(config, messageTransport) {
        super();
        this.messageHandler = null;
        this.txHandler = null;
        this.messageTransport = null;
        this.clients = new Map();
        this.isRunning = false;
        this.seenNonces = new Set(); // 재전송 공격 방지
        // 필수 설정 확인
        if (!config.cluster || !config.phoneNumber || !config.host || !config.keyPair) {
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
        // 기본 트랜잭션 핸들러 설정
        this.txHandler = this.defaultTxHandler.bind(this);
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
     * 기본 트랜잭션 핸들러
     * 클라이언트가 보낸 Solana 트랜잭션을 직렬화하고, 서명을 추가한 후 네트워크에 브로드캐스트합니다.
     */
    async defaultTxHandler(serializedTx) {
        try {
            // deserialize
            const transaction = web3_js_1.VersionedTransaction.deserialize(bs58_1.default.decode(serializedTx));
            // sign
            transaction.sign([this.keypair]);
            // broadcast
            const txid = await this.connection.sendTransaction(transaction, {
                maxRetries: 20,
            });
            console.log(`Transaction Submitted: ${txid}`);
            // confirm
            let latestBlockhash = await this.connection.getLatestBlockhash("confirmed");
            const confirmation = await this.connection.confirmTransaction({
                signature: txid,
                blockhash: latestBlockhash.blockhash,
                lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
            }, "confirmed");
            if (confirmation.value.err) {
                throw new Error("🚨Transaction not confirmed.");
            }
            console.log(`Transaction Successfully Confirmed! 🎉 View on SolScan: https://solscan.io/tx/${txid}?cluster=devnet`);
            return txid;
        }
        catch (error) {
            if (error instanceof web3_js_1.SendTransactionError) {
                const logs = await error.getLogs(this.connection);
                console.log('logs: ', logs);
                this.emit('error', new Error(`트랜잭션 처리 오류: ${error.message}`));
            }
            else {
                this.emit('error', new Error(`트랜잭션 처리 오류: ${error}`));
            }
            throw error;
        }
    }
    /**
     * 서버를 시작하고 수신 연결을 기다립니다.
     */
    async run() {
        if (this.isRunning) {
            return;
        }
        try {
            if (!this.messageTransport) {
                throw new Error('메시지 전송 인터페이스가 설정되지 않았습니다.');
            }
            // 메시지 수신 시작
            const success = await this.messageTransport.startListening();
            if (!success) {
                throw new Error('메시지 수신을 시작할 수 없습니다.');
            }
            this.isRunning = true;
            this.emit('running');
        }
        catch (error) {
            this.emit('error', error);
            throw error;
        }
        // await this.messageTransport.sendMessage(JSON.stringify({"key": "gm"}));
    }
    /**
     * 서버를 중지합니다.
     */
    async stop() {
        if (!this.isRunning) {
            return;
        }
        if (this.messageTransport) {
            this.messageTransport.stopListening();
        }
        this.isRunning = false;
        this.emit('stopped');
    }
    /**
     * 메시지를 처리합니다.
     */
    handleIncomingMessage(messageStr) {
        try {
            // JSON 파싱 시도
            const request = JSON.parse(messageStr);
            // 요청 처리
            this.processIncomingRequest(request, 'message-source');
        }
        catch (error) {
            this.emit('error', new Error(`메시지 처리 오류: ${error}`));
        }
    }
    /**
     * 수신 요청을 처리합니다.
     */
    async processIncomingRequest(request, source) {
        try {
            // 메시지 구조 확인
            if (!request.sig || !request.msg || !request.msg.headers || request.msg.body === undefined) {
                this.emit('error', new Error('잘못된 SAL 메시지 형식'));
                return;
            }
            // nonce 확인 (재전송 공격 방지)
            // const nonce = request.msg.headers.nonce;
            // if (this.seenNonces.has(nonce)) {
            //   this.emit('error', new Error('이미 처리된 nonce'));
            //   return;
            // }
            // this.seenNonces.add(nonce);
            // 서명 확인
            const isValid = this.verifySignature(request.msg.headers.publicKey, JSON.stringify(request.msg), request.sig);
            if (!isValid) {
                this.emit('error', new Error('잘못된 메시지 서명'));
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
                    this.emit('error', new Error(`알 수 없는 메서드: ${request.method}`));
            }
        }
        catch (error) {
            this.emit('error', error);
        }
    }
    /**
     * GM(인사) 메시지를 처리합니다.
     */
    async handleGM(headers, body, source) {
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
                await this.messageHandler(messageStr, source);
                // 확인 응답 전송
                await this.sendResponse(headers, { received: true }, source, 'ok');
            }
            catch (error) {
                await this.sendResponse(headers, { error: String(error) }, source, 'error');
            }
        }
        else {
            await this.sendResponse(headers, { error: 'No message handler' }, source, 'error');
        }
    }
    /**
     * 트랜잭션을 처리합니다.
     */
    async handleTransaction(headers, transaction, source) {
        try {
            const result = await this.txHandler(transaction);
            await this.sendResponse(headers, { signature: result }, source, 'ok');
        }
        catch (error) {
            await this.sendResponse(headers, { error: String(error) }, source, 'error');
        }
    }
    /**
     * 클라이언트에 응답을 전송합니다.
     */
    async sendResponse(requestHeaders, body, destination, status = 'ok') {
        if (!this.messageTransport) {
            this.emit('error', new Error('메시지 전송 인터페이스가 설정되지 않았습니다.'));
            return;
        }
        // delay 1.5 sec for stable interaction
        await new Promise(resolve => setTimeout(resolve, 2000));
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
        // 메시지 전송
        await this.messageTransport.sendMessage(responseJson);
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
            this.emit('error', new Error(`서명 확인 오류: ${error}`));
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
            this.emit('error', new Error(`서명 생성 오류: ${error}`));
            return 'invalid-signature';
        }
    }
}
exports.SalHost = SalHost;
