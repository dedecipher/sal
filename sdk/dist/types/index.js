"use strict";
/**
 * Types for secure Solana transactions through S3L (Secure Solana Link) communication
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SalMethod = exports.Modality = void 0;
var Modality;
(function (Modality) {
    Modality["VOICE"] = "voice";
    Modality["TCP"] = "tcp";
})(Modality || (exports.Modality = Modality = {}));
var SalMethod;
(function (SalMethod) {
    SalMethod["GM"] = "gm";
    SalMethod["MSG"] = "msg";
    SalMethod["TX"] = "tx";
})(SalMethod || (exports.SalMethod = SalMethod = {}));
