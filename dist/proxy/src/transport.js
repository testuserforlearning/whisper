"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchThroughBareMux = fetchThroughBareMux;
const node_fetch_1 = __importDefault(require("node-fetch"));
const MAX_REDIRECTS = 10;
async function fetchThroughBareMux(url, options = {}) {
    let currentUrl = url;
    let redirectCount = 0;
    while (redirectCount < MAX_REDIRECTS) {
        let resp;
        try {
            const bareMux = require('bare-mux');
            if (bareMux && typeof bareMux.fetch === 'function') {
                resp = await bareMux.fetch(currentUrl, {
                    method: options.method || 'GET',
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                        'Accept-Language': 'en-US,en;q=0.9',
                        'Accept-Encoding': 'identity',
                        ...options.headers
                    },
                    body: options.body,
                    redirect: 'manual'
                });
            }
            else {
                throw new Error('bare-mux not available');
            }
        }
        catch (err) {
            resp = await (0, node_fetch_1.default)(currentUrl, {
                method: options.method || 'GET',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Accept-Encoding': 'identity',
                    ...options.headers
                },
                body: options.body || undefined,
                compress: false,
                redirect: 'manual'
            });
        }
        if (resp.status >= 300 && resp.status < 400) {
            const location = resp.headers.get('location');
            if (location) {
                try {
                    currentUrl = new URL(location, currentUrl).href;
                }
                catch {
                    currentUrl = location;
                }
                redirectCount++;
                continue;
            }
        }
        const arrayBuffer = await resp.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const headersObj = {};
        resp.headers.forEach((v, k) => headersObj[k] = v);
        return {
            status: resp.status,
            headers: headersObj,
            buffer,
            finalUrl: currentUrl
        };
    }
    throw new Error('Too many redirects');
}
