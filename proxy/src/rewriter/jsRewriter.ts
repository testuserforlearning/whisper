export function rewriteJs(buffer: Buffer, baseUrl: string, proxyBase = '/proxy?url=') {
  let code = buffer.toString('utf8');
  code = code.replace(/(https?:\/\/[^\"'\s<>]+)/g, (match, p1) => {
    try { const u = new URL(p1, baseUrl).toString(); return proxyBase + encodeURIComponent(Buffer.from(u).toString('base64')); } catch(e) { return match; }
  });
  return Buffer.from(code, 'utf8');
}
