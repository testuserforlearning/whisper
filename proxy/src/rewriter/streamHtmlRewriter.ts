import { Writable } from 'stream';
import { Parser } from 'htmlparser2';
import { b64encode } from '../utils';

function renderAttrs(attrs: Record<string,string|undefined>): string {
  return Object.entries(attrs).map(([k,v]) => v == null ? k : `${k}="${v.replace(/"/g,'&quot;')}"`).join(' ');
}

function rewriteCssUrls(cssText: string, baseUrl: string, proxyBase: string) {
  return cssText.replace(/url\((['"]?)(.*?)\1\)/g, (m: string, q: string, url: string) => {
    const val = url.trim();
    const lc = val.toLowerCase();
    if (lc.startsWith('data:') || lc.startsWith('javascript:') || lc.startsWith('mailto:') || lc.startsWith('tel:') || lc.startsWith('#')) return m;
    try { const absolute = new URL(val, baseUrl).toString(); return `url(${q}${proxyBase}${encodeURIComponent(b64encode(absolute))}${q})`; } catch(e) { return m; }
  }).replace(/@import\s+(?:url\()?['"]?(.*?)['"]?\)?;/g, (m: string, url: string) => {
    try { const absolute = new URL(url, baseUrl).toString(); return `@import url('${proxyBase}${encodeURIComponent(b64encode(absolute))}');`; } catch(e) { return m; }
  });
}

export async function rewriteHtmlStream(htmlBuffer: Buffer, baseUrl: string, proxyBase = '/proxy?url=') : Promise<Buffer> {
  const html = htmlBuffer.toString('utf8');
  let out = '';

  const injectRuntime = `\n<script>(function(){/* proxy runtime injected */})();</script>\n`;

  let inStyle = false;
  let styleBuffer = '';

  const parser = new Parser({
    onopentag(name, attribs) {
      const lname = name.toLowerCase();
      // strip integrity/crossorigin and rewrite resource attributes
      if (attribs.integrity) delete attribs.integrity;
      if (attribs.crossorigin) delete attribs.crossorigin;

      const rewriteAttr = (attrName: string) => {
        const val = attribs[attrName];
        if (!val) return;
        const lc = val.trim().toLowerCase();
        if (lc.startsWith('data:') || lc.startsWith('javascript:') || lc.startsWith('mailto:') || lc.startsWith('tel:') || lc.startsWith('#')) return;
        try { const absolute = new URL(val, baseUrl).toString(); attribs[attrName] = `${proxyBase}${encodeURIComponent(b64encode(absolute))}`; } catch(e) { }
      };

      if (attribs.src) rewriteAttr('src');
      if (attribs.href) rewriteAttr('href');
      if (attribs.action) rewriteAttr('action');
      if (attribs.srcset) {
        // rewrite each entry in srcset
        const parts = attribs.srcset.split(',').map(p=>p.trim()).map(entry => {
          const [url, descriptor] = entry.split(/\s+/, 2);
          try { const absolute = new URL(url, baseUrl).toString(); return `${proxyBase}${encodeURIComponent(b64encode(absolute))}` + (descriptor ? ' '+descriptor : ''); } catch(e){ return entry; }
        });
        attribs.srcset = parts.join(', ');
      }

      if (lname === 'style') {
        inStyle = true;
        styleBuffer = '';
      }

      out += `<${name}` + (Object.keys(attribs).length ? ' ' + renderAttrs(attribs as any) : '') + '>';
    },
    ontext(text) {
      if (inStyle) {
        styleBuffer += text;
      } else {
        out += text;
      }
    },
    oncomment(data) {
      out += `<!--${data}-->`;
    },
    onclosetag(tagname) {
      const lname = tagname.toLowerCase();
      if (lname === 'style') {
        // rewrite CSS urls inside style block
        out += rewriteCssUrls(styleBuffer, baseUrl, proxyBase);
        inStyle = false;
        styleBuffer = '';
      }

      if (lname === 'body') {
        out += injectRuntime;
      }
      out += `</${tagname}>`;
    }
  }, { decodeEntities: true });

  parser.write(html);
  parser.end();

  return Buffer.from(out, 'utf8');
}

export default rewriteHtmlStream;
