"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleProxyRequest = handleProxyRequest;
exports.handleChunkRequest = handleChunkRequest;
const transport_1 = require("./transport");
const utils_1 = require("./utils");
const rewriter_1 = require("./rewriter");
async function handleProxyRequest(req, res) {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS,HEAD,PATCH');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
    res.set('Access-Control-Allow-Credentials', 'true');
    if (req.method === 'OPTIONS') {
        return res.status(204).send('');
    }
    var encoded = req.query.url;
    if (!encoded) {
        const refererHeader = req.headers.referer || req.headers.referrer || '';
        const referer = Array.isArray(refererHeader) ? refererHeader[0] : refererHeader;
        if (referer && referer.includes('/proxy?url=')) {
            const match = referer.match(/\/proxy\?url=([^&\s]+)/);
            if (match) {
                try {
                    const baseUrl = (0, utils_1.b64decode)(match[1]);
                    const baseOrigin = new URL(baseUrl).origin;
                    const queryString = req.originalUrl.includes('?')
                        ? req.originalUrl.substring(req.originalUrl.indexOf('?'))
                        : '';
                    const newTarget = baseOrigin + queryString;
                    encoded = (0, utils_1.b64encode)(newTarget);
                }
                catch (e) { }
            }
        }
        if (!encoded) {
            const queryString = req.originalUrl.includes('?')
                ? req.originalUrl.substring(req.originalUrl.indexOf('?'))
                : '';
            if (queryString) {
                try {
                    const params = new URLSearchParams(queryString.slice(1));
                    if (params.has('q')) {
                        const targetUrl = 'https://www.google.com/search' + queryString;
                        encoded = (0, utils_1.b64encode)(targetUrl);
                    }
                }
                catch (e) { }
            }
        }
        if (!encoded) {
            return res.status(400).send('Missing url query parameter');
        }
    }
    var target;
    try {
        target = (0, utils_1.b64decode)(encoded);
    }
    catch (e) {
        return res.status(400).send('Invalid base64 url');
    }
    try {
        var result = await (0, transport_1.fetchThroughBareMux)(target, { method: req.method || 'GET' });
        const baseForRewriting = result.finalUrl || target;
        if (result.status === 404) {
            return res.redirect('/404.html');
        }
        var normalized = {};
        Object.entries(result.headers).forEach(function ([k, v]) {
            if (v != null)
                normalized[k.toLowerCase()] = v;
        });
        delete normalized['content-security-policy'];
        delete normalized['content-security-policy-report-only'];
        delete normalized['x-frame-options'];
        delete normalized['frame-options'];
        delete normalized['content-encoding'];
        delete normalized['content-length'];
        var ct = normalized['content-type'] || '';
        var hopByHop = new Set(['connection', 'transfer-encoding', 'keep-alive', 'proxy-authenticate', 'proxy-authorization', 'upgrade']);
        if ((0, utils_1.isHtmlContentType)(ct)) {
            var html = result.buffer.toString('utf-8');
            var rewritten = (0, rewriter_1.rewriteHtml)(html, baseForRewriting);
            res.set('content-type', 'text/html; charset=utf-8');
            Object.entries(normalized).forEach(function ([k, v]) {
                if (!hopByHop.has(k) && v != null)
                    res.set(k, v);
            });
            return res.status(result.status).send(rewritten);
        }
        if (ct.indexOf('javascript') !== -1 || ct.indexOf('ecmascript') !== -1) {
            var js = result.buffer.toString('utf-8');
            var rewrittenJs = (0, rewriter_1.rewriteJs)(js, baseForRewriting);
            res.set('content-type', ct);
            Object.entries(normalized).forEach(function ([k, v]) {
                if (!hopByHop.has(k) && v != null)
                    res.set(k, v);
            });
            return res.status(result.status).send(rewrittenJs);
        }
        if (ct.indexOf('text/css') !== -1) {
            var css = result.buffer.toString('utf-8');
            var rewrittenCss = (0, rewriter_1.rewriteCss)(css, baseForRewriting);
            res.set('content-type', 'text/css; charset=utf-8');
            Object.entries(normalized).forEach(function ([k, v]) {
                if (!hopByHop.has(k) && v != null)
                    res.set(k, v);
            });
            return res.status(result.status).send(rewrittenCss);
        }
        if (ct.indexOf('image/svg+xml') !== -1) {
            var svg = result.buffer.toString('utf-8');
            var rewrittenSvg = (0, rewriter_1.rewriteSvg)(svg, baseForRewriting);
            res.set('content-type', 'image/svg+xml');
            Object.entries(normalized).forEach(function ([k, v]) {
                if (!hopByHop.has(k) && v != null)
                    res.set(k, v);
            });
            return res.status(result.status).send(rewrittenSvg);
        }
        if (ct.indexOf('application/manifest+json') !== -1 || ct.indexOf('application/json') !== -1 && baseForRewriting.includes('manifest')) {
            var manifest = result.buffer.toString('utf-8');
            var rewrittenManifest = (0, rewriter_1.rewriteManifest)(manifest, baseForRewriting);
            res.set('content-type', ct);
            Object.entries(normalized).forEach(function ([k, v]) {
                if (!hopByHop.has(k) && v != null)
                    res.set(k, v);
            });
            return res.status(result.status).send(rewrittenManifest);
        }
        if (!ct) {
            var lower = baseForRewriting.split('?')[0].toLowerCase();
            if (lower.endsWith('.wasm'))
                normalized['content-type'] = 'application/wasm';
            else if (lower.endsWith('.woff'))
                normalized['content-type'] = 'font/woff';
            else if (lower.endsWith('.woff2'))
                normalized['content-type'] = 'font/woff2';
            else if (lower.endsWith('.ttf'))
                normalized['content-type'] = 'font/ttf';
            else if (lower.endsWith('.otf'))
                normalized['content-type'] = 'font/otf';
            else if (lower.endsWith('.svg'))
                normalized['content-type'] = 'image/svg+xml';
            else if (lower.endsWith('.png'))
                normalized['content-type'] = 'image/png';
            else if (lower.endsWith('.jpg') || lower.endsWith('.jpeg'))
                normalized['content-type'] = 'image/jpeg';
            else if (lower.endsWith('.gif'))
                normalized['content-type'] = 'image/gif';
            else if (lower.endsWith('.js')) {
                var jsContent = result.buffer.toString('utf-8');
                var rewrittenJsContent = (0, rewriter_1.rewriteJs)(jsContent, baseForRewriting);
                normalized['content-type'] = 'application/javascript';
                Object.entries(normalized).forEach(function ([k, v]) {
                    if (!hopByHop.has(k) && v != null)
                        res.set(k, v);
                });
                return res.status(result.status).send(rewrittenJsContent);
            }
            else if (lower.endsWith('.css')) {
                var cssContent = result.buffer.toString('utf-8');
                var rewrittenCssContent = (0, rewriter_1.rewriteCss)(cssContent, baseForRewriting);
                normalized['content-type'] = 'text/css';
                Object.entries(normalized).forEach(function ([k, v]) {
                    if (!hopByHop.has(k) && v != null)
                        res.set(k, v);
                });
                return res.status(result.status).send(rewrittenCssContent);
            }
            else if (lower.endsWith('.html') || lower.endsWith('.htm')) {
                var htmlContent = result.buffer.toString('utf-8');
                var rewrittenHtmlContent = (0, rewriter_1.rewriteHtml)(htmlContent, baseForRewriting);
                normalized['content-type'] = 'text/html';
                Object.entries(normalized).forEach(function ([k, v]) {
                    if (!hopByHop.has(k) && v != null)
                        res.set(k, v);
                });
                return res.status(result.status).send(rewrittenHtmlContent);
            }
        }
        Object.entries(normalized).forEach(function ([k, v]) {
            if (!hopByHop.has(k) && v != null)
                res.set(k, v);
        });
        try {
            res.set('content-length', String(result.buffer.length));
        }
        catch (e) { }
        return res.status(result.status).send(result.buffer);
    }
    catch (err) {
        return res.redirect('/404.html');
    }
}
async function handleChunkRequest(req, res) {
    const refererHeader = req.headers.referer || req.headers.referrer || '';
    const referer = Array.isArray(refererHeader) ? refererHeader[0] : refererHeader;
    let baseUrl = '';
    if (referer && referer.includes('/proxy?url=')) {
        const match = referer.match(/\/proxy\?url=([^&\s]+)/);
        if (match) {
            try {
                baseUrl = (0, utils_1.b64decode)(match[1]);
            }
            catch (e) { }
        }
    }
    if (!baseUrl) {
        return res.status(404).send('Not found');
    }
    try {
        const baseOrigin = new URL(baseUrl).origin;
        const chunkPath = req.path;
        const queryString = req.originalUrl.includes('?')
            ? req.originalUrl.substring(req.originalUrl.indexOf('?'))
            : '';
        const targetUrl = baseOrigin + chunkPath + queryString;
        const result = await (0, transport_1.fetchThroughBareMux)(targetUrl, { method: 'GET' });
        const finalUrl = result.finalUrl || targetUrl;
        var normalized = {};
        Object.entries(result.headers).forEach(function ([k, v]) {
            if (v != null)
                normalized[k.toLowerCase()] = v;
        });
        delete normalized['content-security-policy'];
        delete normalized['content-security-policy-report-only'];
        delete normalized['x-frame-options'];
        delete normalized['content-encoding'];
        delete normalized['content-length'];
        var ct = normalized['content-type'] || '';
        var hopByHop = new Set(['connection', 'transfer-encoding', 'keep-alive', 'proxy-authenticate', 'proxy-authorization', 'upgrade']);
        if (ct.includes('text/html') || ct.includes('application/xhtml+xml')) {
            var html = result.buffer.toString('utf-8');
            var rewrittenHtml = (0, rewriter_1.rewriteHtml)(html, finalUrl);
            res.set('content-type', 'text/html; charset=utf-8');
            Object.entries(normalized).forEach(function ([k, v]) {
                if (!hopByHop.has(k) && v != null)
                    res.set(k, v);
            });
            return res.status(result.status).send(rewrittenHtml);
        }
        if (ct.includes('javascript') || ct.includes('ecmascript') || chunkPath.endsWith('.js')) {
            var js = result.buffer.toString('utf-8');
            var rewrittenJs = (0, rewriter_1.rewriteJs)(js, finalUrl);
            res.set('content-type', ct || 'application/javascript');
            Object.entries(normalized).forEach(function ([k, v]) {
                if (!hopByHop.has(k) && v != null)
                    res.set(k, v);
            });
            return res.status(result.status).send(rewrittenJs);
        }
        if (ct.includes('text/css') || chunkPath.endsWith('.css')) {
            var css = result.buffer.toString('utf-8');
            var rewrittenCss = (0, rewriter_1.rewriteCss)(css, finalUrl);
            res.set('content-type', ct || 'text/css');
            Object.entries(normalized).forEach(function ([k, v]) {
                if (!hopByHop.has(k) && v != null)
                    res.set(k, v);
            });
            return res.status(result.status).send(rewrittenCss);
        }
        // Pass through other content
        Object.entries(normalized).forEach(function ([k, v]) {
            if (!hopByHop.has(k) && v != null)
                res.set(k, v);
        });
        return res.status(result.status).send(result.buffer);
    }
    catch (err) {
        return res.status(404).send('Not found');
    }
}
