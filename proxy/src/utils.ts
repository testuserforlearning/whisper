export function b64encode(s: string): string {
  return Buffer.from(s, 'utf8').toString('base64');
}

export function b64decode(s: string): string {
  return Buffer.from(s, 'base64').toString('utf8');
}

export function isHtmlContentType(ct?: string): boolean {
  if (!ct) return false;
  return ct.includes('text/html') || ct.includes('application/xhtml+xml');
}
