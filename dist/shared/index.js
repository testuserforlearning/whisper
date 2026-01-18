"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
exports.flagEnabled = flagEnabled;
exports.codecEncode = codecEncode;
exports.codecDecode = codecDecode;
exports.config = {
    prefix: '/proxy?url=',
    useBase64: true
};
function flagEnabled(flag, base) {
    return false;
}
function codecEncode(str) {
    if (typeof Buffer !== 'undefined') {
        return Buffer.from(str, 'utf8').toString('base64');
    }
    return btoa(str);
}
function codecDecode(str) {
    if (typeof Buffer !== 'undefined') {
        return Buffer.from(str, 'base64').toString('utf8');
    }
    return atob(str);
}
