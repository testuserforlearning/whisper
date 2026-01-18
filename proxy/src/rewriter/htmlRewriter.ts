import * as cheerio from 'cheerio';
import { b64encode } from '../utils';

export function rewriteHtml(htmlBuffer: Buffer, baseUrl: string, proxyBase = '/proxy?url=') {
  const html = htmlBuffer.toString('utf8');
  try {
    const load = (cheerio as any).load || (cheerio as any).default?.load;
    if (typeof load !== 'function') return htmlBuffer;
    const $ = load(html);

  const rewriteAttr = (selector: string, attr: string) => {
    $(selector).each((_: any, el: any) => {
      const $el = $(el as any);
      const orig = $el.attr(attr);
      if (!orig) return;
      const lc = orig.trim().toLowerCase();
      if (lc.startsWith('data:') || lc.startsWith('javascript:') || lc.startsWith('mailto:') || lc.startsWith('tel:') || lc.startsWith('#')) return;
      let absolute = orig;
      try { absolute = new URL(orig, baseUrl).toString(); } catch (e) { return; }
      $el.removeAttr('integrity');
      $el.removeAttr('crossorigin');
      $el.attr(attr, `${proxyBase}${encodeURIComponent(b64encode(absolute))}`);
    });
  };

  rewriteAttr('a', 'href');
  rewriteAttr('img', 'src');
  rewriteAttr('script', 'src');
  rewriteAttr('link', 'href');
  rewriteAttr('form', 'action');

  const clientRuntime = `(function(){
    document.addEventListener('click', function(e){
      var a = e.target && e.target.closest && e.target.closest('a');
      if (a && a.href) {
        e.preventDefault();
        try{
          const proxied = '/proxy?url=' + encodeURIComponent(btoa(unescape(encodeURIComponent(a.href))));
          window.parent.postMessage({ type: 'whisper-open', url: proxied }, '*');
        }catch(err){
          window.location.href = '/proxy?url=' + encodeURIComponent(btoa(unescape(encodeURIComponent(a.href))));
        }
      }
    }, true);
    const _fetch = window.fetch.bind(window);
    window.fetch = function(input, init){ try{ const url = (typeof input === 'string') ? input : input.url; const proxied = '/proxy?url=' + encodeURIComponent(btoa(unescape(encodeURIComponent(url)))); if (typeof input === 'string') return _fetch(proxied, init); const newReq = new Request(proxied, input); return _fetch(newReq, init); }catch(e){ return _fetch(input, init); } };
    const _append = Node.prototype.appendChild;
    Node.prototype.appendChild = function(node){ try{ if(node && node.tagName === 'SCRIPT' && node.src){ node.removeAttribute && node.removeAttribute('integrity'); node.removeAttribute && node.removeAttribute('crossorigin'); node.src = '/proxy?url=' + encodeURIComponent(btoa(unescape(encodeURIComponent(node.src)))); } if(node && node.tagName === 'LINK' && node.href){ node.removeAttribute && node.removeAttribute('integrity'); node.removeAttribute && node.removeAttribute('crossorigin'); node.href = '/proxy?url=' + encodeURIComponent(btoa(unescape(encodeURIComponent(node.href)))); } }catch(e){} return _append.call(this,node); };
    const _insert = Node.prototype.insertBefore;
    Node.prototype.insertBefore = function(node, ref){ try{ if(node && node.tagName === 'SCRIPT' && node.src){ node.removeAttribute && node.removeAttribute('integrity'); node.removeAttribute && node.removeAttribute('crossorigin'); node.src = '/proxy?url=' + encodeURIComponent(btoa(unescape(encodeURIComponent(node.src)))); } if(node && node.tagName === 'LINK' && node.href){ node.removeAttribute && node.removeAttribute('integrity'); node.removeAttribute && node.removeAttribute('crossorigin'); node.href = '/proxy?url=' + encodeURIComponent(btoa(unescape(encodeURIComponent(node.href)))); } }catch(e){} return _insert.call(this,node, ref); };
    const _replace = Node.prototype.replaceChild;
    Node.prototype.replaceChild = function(newChild, oldChild){ try{ if(newChild && newChild.tagName === 'SCRIPT' && newChild.src){ newChild.removeAttribute && newChild.removeAttribute('integrity'); newChild.removeAttribute && newChild.removeAttribute('crossorigin'); newChild.src = '/proxy?url=' + encodeURIComponent(btoa(unescape(encodeURIComponent(newChild.src)))); } if(newChild && newChild.tagName === 'LINK' && newChild.href){ newChild.removeAttribute && newChild.removeAttribute('integrity'); newChild.removeAttribute && newChild.removeAttribute('crossorigin'); newChild.href = '/proxy?url=' + encodeURIComponent(btoa(unescape(encodeURIComponent(newChild.href)))); } }catch(e){} return _replace.call(this,newChild, oldChild); };
    try{
      const params = new URLSearchParams(window.location.search || '');
      const enc = params.get('url');
      if (enc) {
        try{
          const orig = decodeURIComponent(enc);
          const target = decodeURIComponent(escape(atob(orig)));
          const base = new URL('.', target).toString();
          const proxiedBase = '/proxy?url=' + encodeURIComponent(btoa(base));
          try{ (window as any).__webpack_public_path__ = proxiedBase; }catch(e){}
        }catch(e){}
      }
    }catch(e){}
  })();`;

  $('body').append(`<script>${clientRuntime}</script>`);

  return Buffer.from($.html(), 'utf8');
  } catch (err) {
    return htmlBuffer;
  }
}

 
