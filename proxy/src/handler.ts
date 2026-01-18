import { Request, Response } from 'express';
import { fetchThroughBareMux } from './transport';
import { b64decode, isHtmlContentType } from './utils';
import { rewriteHtmlStream } from './rewriter/streamHtmlRewriter';
import { rewriteJs } from './rewriter/jsRewriter';
import { rewriteCssBuffer } from './rewriter/cssRewriter';

export async function handleProxyRequest(req: Request, res: Response) {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept');

  if (req.method === 'OPTIONS') return res.status(204).send('');

  const encoded = req.query.url as string | undefined;
  if (!encoded) return res.status(400).send('Missing url query parameter');

  let target: string;
  try {
    target = b64decode(encoded);
  } catch (e) {
    return res.status(400).send('Invalid base64 url');
  }

  try {
    const result = await fetchThroughBareMux(target, { method: 'GET' });

    const normalized: Record<string,string> = {};
    Object.entries(result.headers).forEach(([k, v]) => { if (v != null) normalized[k.toLowerCase()] = v; });

    delete normalized['content-security-policy'];
    delete normalized['content-security-policy-report-only'];
    delete normalized['x-frame-options'];
    delete normalized['frame-options'];

    const ct = normalized['content-type'] || '';

    const hopByHop = new Set(['connection','transfer-encoding','keep-alive','proxy-authenticate','proxy-authorization','upgrade']);

    if (isHtmlContentType(ct)) {
      const rewritten = await rewriteHtmlStream(result.buffer, target);
      res.set('content-type', 'text/html; charset=utf-8');
      delete normalized['content-encoding'];
      delete normalized['content-length'];
      Object.entries(normalized).forEach(([k, v]) => { if (!hopByHop.has(k) && v != null) res.set(k, v as string); });
      return res.status(result.status).send(rewritten);
    }

    if ((ct || '').includes('javascript')) {
      const rewritten = rewriteJs(result.buffer, target);
      res.set('content-type', ct);
      delete normalized['content-encoding'];
      delete normalized['content-length'];
      Object.entries(normalized).forEach(([k, v]) => { if (!hopByHop.has(k) && v != null) res.set(k, v as string); });
      return res.status(result.status).send(rewritten);
    }

    if (((ct || normalized['content-type']) || '').includes('text/css')) {
      const rewritten = rewriteCssBuffer(result.buffer, target);
      res.set('content-type', 'text/css; charset=utf-8');
      delete normalized['content-encoding'];
      delete normalized['content-length'];
      Object.entries(normalized).forEach(([k, v]) => { if (!hopByHop.has(k) && v != null) res.set(k, v as string); });
      return res.status(result.status).send(rewritten);
    }

    if (!ct) {
      const lower = target.split('?')[0].toLowerCase();
      if (lower.endsWith('.wasm')) normalized['content-type'] = 'application/wasm';
      else if (lower.endsWith('.woff')) normalized['content-type'] = 'font/woff';
      else if (lower.endsWith('.woff2')) normalized['content-type'] = 'font/woff2';
      else if (lower.endsWith('.ttf')) normalized['content-type'] = 'font/ttf';
      else if (lower.endsWith('.otf')) normalized['content-type'] = 'font/otf';
      else if (lower.endsWith('.svg')) normalized['content-type'] = 'image/svg+xml';
      else if (lower.endsWith('.png')) normalized['content-type'] = 'image/png';
      else if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) normalized['content-type'] = 'image/jpeg';
      else if (lower.endsWith('.gif')) normalized['content-type'] = 'image/gif';
    }

    Object.entries(normalized).forEach(([k, v]) => {
      if (!hopByHop.has(k) && v != null) res.set(k, v as string);
    });

    try { res.set('content-length', String(result.buffer.length)); } catch (e) {}

    if ((ct || normalized['content-type'] || '').includes('text/css')) console.log('proxied css:', target);
    return res.status(result.status).send(result.buffer);
  } catch (err: any) {
    res.status(502).send('Upstream fetch failed: ' + (err && err.message ? err.message : 'error'));
  }
}
