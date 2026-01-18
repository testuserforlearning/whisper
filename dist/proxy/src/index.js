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
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const router_1 = require("./router");
const ws_1 = __importStar(require("ws"));
const utils_1 = require("./utils");
const app = (0, express_1.default)();
const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;
app.use((0, router_1.createRouter)());
const server = http_1.default.createServer(app);
const wsServer = new ws_1.Server({ noServer: true });
server.on('upgrade', (req, socket, head) => {
    const pathname = req.url || '/';
    const rawReferer = req.headers.referer ?? req.headers.referrer;
    const referer = Array.isArray(rawReferer) ? rawReferer[0] : rawReferer;
    let targetOrigin = null;
    try {
        if (referer) {
            const u = new URL(referer);
            const encoded = u.searchParams.get('url');
            if (encoded)
                targetOrigin = new URL((0, utils_1.b64decode)(encoded)).origin;
        }
    }
    catch (e) {
        targetOrigin = null;
    }
    if (!targetOrigin) {
        socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
        socket.destroy();
        return;
    }
    try {
        const upstreamProto = targetOrigin.startsWith('https:') ? 'wss:' : 'ws:';
        const upstreamUrl = `${upstreamProto}//${new URL(targetOrigin).host}${pathname}`;
        wsServer.handleUpgrade(req, socket, head, (clientWs) => {
            const upstream = new ws_1.default(upstreamUrl);
            clientWs.on('message', (msg) => { if (upstream.readyState === ws_1.default.OPEN)
                upstream.send(msg); });
            upstream.on('message', (msg) => { if (clientWs.readyState === ws_1.default.OPEN)
                clientWs.send(msg); });
            const cleanup = () => { try {
                upstream.close();
            }
            catch { } };
            clientWs.on('close', cleanup);
            clientWs.on('error', cleanup);
            upstream.on('close', () => { try {
                clientWs.close();
            }
            catch { } });
            upstream.on('error', () => { try {
                clientWs.close();
            }
            catch { } });
        });
    }
    catch (e) {
        socket.write('HTTP/1.1 502 Bad Gateway\r\n\r\n');
        socket.destroy();
        return;
    }
});
server.listen(port, () => {
    console.log(`Whisper proxy demo listening on http://localhost:${port}`);
    console.log(`Open http://localhost:${port}/ to access the demo UI`);
});
