"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRouter = createRouter;
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const handler_1 = require("./handler");
function createRouter() {
    const router = express_1.default.Router();
    const demoPublic = path_1.default.join(__dirname, '..', '..', 'demo', 'public');
    router.use('/', express_1.default.static(demoPublic));
    router.get('/proxy', handler_1.handleProxyRequest);
    router.get('/r/:ext/:encoded', handler_1.handleProxyRequest);
    router.get('*', handler_1.handleChunkRequest);
    return router;
}
