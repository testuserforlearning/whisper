import { b64encode } from '../utils';

export function rewriteCssBuffer(buffer: Buffer, baseUrl: string, proxyBase = '/proxy?url=') : Buffer {
  const css = buffer.toString('utf8');
  const rewritten = css
    .replace(/url\((['"]?)(.*?)\1\)/g, (m: string, q: string, url: string) => {
      const val = url.trim();
      const lc = val.toLowerCase();
      if (lc.startsWith('data:') || lc.startsWith('javascript:') || lc.startsWith('mailto:') || lc.startsWith('tel:') || lc.startsWith('#')) return m;
      try { const absolute = new URL(val, baseUrl).toString(); return `url(${q}${proxyBase}${encodeURIComponent(b64encode(absolute))}${q})`; } catch(e) { return m; }
    })
    .replace(/@import\s+(?:url\()?['"]?(.*?)['"]?\)?;/g, (m: string, url: string) => {
      try { const absolute = new URL(url, baseUrl).toString(); return `@import url('${proxyBase}${encodeURIComponent(b64encode(absolute))}');`; } catch(e) { return m; }
    });

  return Buffer.from(rewritten, 'utf8');
}
