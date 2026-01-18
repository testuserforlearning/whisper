"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.b64encode = b64encode;
exports.b64decode = b64decode;
exports.isHtmlContentType = isHtmlContentType;
function b64encode(s) {
    return Buffer.from(s, 'utf8').toString('base64');
}
function b64decode(s) {
    return Buffer.from(s, 'base64').toString('utf8');
}
function isHtmlContentType(ct) {
    if (!ct)
        return false;
    return ct.includes('text/html') || ct.includes('application/xhtml+xml');
}
