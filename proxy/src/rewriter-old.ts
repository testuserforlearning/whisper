import * as parse5 from 'parse5';
import * as csstree from 'css-tree';
import { config, codecEncode, codecDecode } from '../../shared/index';

const urlAttrs = new Set(['href', 'src', 'action', 'data', 'poster', 'formaction', 'cite', 'manifest', 'icon', 'background']);
const srcsetAttrs = new Set(['srcset', 'imagesrcset']);
const styleAttrs = new Set(['style']);
const skipPatterns = [
    /googletagmanager\.com/i, 
    /google-analytics\.com/i, 
    /gtag/i, 
    /gtm\.js/i, 
    /collector\.github\.com/i, 
    /api\.github\.com\/_private/i,
    /analytics/i
];

function shouldSkipUrl(url: string): boolean {
    if (!url) return true;
    const trimmed = url.trim();
    if (!trimmed) return true;
    if (trimmed.startsWith('data:')) return true;
    if (trimmed.startsWith('javascript:')) return true;
    if (trimmed.startsWith('blob:')) return true;
    if (trimmed.startsWith('about:')) return true;
    if (trimmed.startsWith('#')) return true;
    if (trimmed.startsWith('mailto:')) return true;
    if (trimmed.startsWith('tel:')) return true;
    if (trimmed.startsWith(config.prefix)) return true;
    return skipPatterns.some(p => p.test(trimmed));
}

function resolveUrl(url: string, base: string): string {
    try {
        return new URL(url, base).href;
    } catch {
        return url;
    }
}

export function rewriteUrl(url: string, base: string): string {
    if (shouldSkipUrl(url)) return url;
    const resolved = resolveUrl(url, base);
    return config.prefix + codecEncode(resolved);
}

export function unrewriteUrl(url: string): string {
    if (url.startsWith(config.prefix)) {
        try {
            return codecDecode(url.slice(config.prefix.length));
        } catch {
            return url;
        }
    }
    return url;
}

export function rewriteSrcset(srcset: string, base: string): string {
    return srcset.split(',').map(entry => {
        const parts = entry.trim().split(/\s+/);
        if (parts.length === 0) return entry;
        const url = parts[0];
        if (!shouldSkipUrl(url)) {
            parts[0] = rewriteUrl(url, base);
        }
        return parts.join(' ');
    }).join(', ');
}

export function rewriteCss(css: string, base: string): string {
    try {
        const ast = csstree.parse(css, { parseValue: true, parseAtrulePrelude: true });
        csstree.walk(ast, (node: csstree.CssNode) => {
            if (node.type === 'Url') {
                const urlNode = node as csstree.Url;
                let value = '';
                const nodeValue = urlNode.value as any;
                if (nodeValue) {
                    if (typeof nodeValue === 'string') {
                        value = nodeValue;
                    } else if (nodeValue.type === 'String') {
                        value = nodeValue.value.replace(/^['"]|['"]$/g, '');
                    } else if (nodeValue.type === 'Raw') {
                        value = nodeValue.value;
                    }
                }
                if (value && !shouldSkipUrl(value)) {
                    const rewritten = rewriteUrl(value, base);
                    (urlNode as any).value = { type: 'Raw', value: rewritten };
                }
            }
            if (node.type === 'Atrule') {
                const atrule = node as csstree.Atrule;
                if (atrule.name === 'import' && atrule.prelude) {
                    if (atrule.prelude.type === 'AtrulePrelude') {
                        csstree.walk(atrule.prelude, (child: csstree.CssNode) => {
                            if (child.type === 'String') {
                                const strNode = child as csstree.StringNode;
                                const strValue = strNode.value.replace(/^['"]|['"]$/g, '');
                                if (!shouldSkipUrl(strValue)) {
                                    strNode.value = `"${rewriteUrl(strValue, base)}"`;
                                }
                            }
                        });
                    }
                }
            }
        });
        return csstree.generate(ast);
    } catch {
        return rewriteCssFallback(css, base);
    }
}

function rewriteCssFallback(css: string, base: string): string {
    let result = css;
    result = result.replace(/url\s*\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (match, quote, url) => {
        if (shouldSkipUrl(url)) return match;
        return `url(${quote}${rewriteUrl(url, base)}${quote})`;
    });
    result = result.replace(/@import\s+(['"])([^'"]+)\1/gi, (match, quote, url) => {
        if (shouldSkipUrl(url)) return match;
        return `@import ${quote}${rewriteUrl(url, base)}${quote}`;
    });
    return result;
}

export function rewriteInlineStyle(style: string, base: string): string {
    return style.replace(/url\s*\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (match, quote, url) => {
        if (shouldSkipUrl(url)) return match;
        return `url(${quote}${rewriteUrl(url, base)}${quote})`;
    });
}

// Generate client-side script that intercepts all requests
function createClientScript(base: string): string {
    const baseUrl = new URL(base);
    const baseOrigin = baseUrl.origin;
    const safeBase = base.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const safeOrigin = baseOrigin.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    
    // This script runs before any other scripts
    return `<script data-whisper="client">
(function(){
'use strict';
var PREFIX='/proxy?url=';
var BASE='${safeBase}';
var BASE_ORIGIN='${safeOrigin}';

// Simple base64 encode that handles unicode
function encode(str){
  try{return btoa(unescape(encodeURIComponent(str)));}
  catch(e){try{return btoa(str);}catch(e2){return str;}}
}

// Check if URL should be skipped
function skip(u){
  if(!u||typeof u!=='string')return true;
  u=u.trim();
  if(!u)return true;
  var dominated=['data:','javascript:','blob:','about:','#','mailto:','tel:'];
  for(var i=0;i<dominated.length;i++){if(u.indexOf(dominated[i])===0)return true;}
  if(u.indexOf(PREFIX)===0||u.indexOf(PREFIX)>0)return true;
  var blocked=['googletagmanager','google-analytics','gtag','collector.github','api.github.com/_private','analytics'];
  for(var j=0;j<blocked.length;j++){if(u.indexOf(blocked[j])!==-1)return true;}
  return false;
}

// Resolve URL against base
function resolve(u,b){
  try{return new URL(u,b).href;}
  catch(e){return u;}
}

// The core rewrite function
function rewrite(u){
  if(skip(u))return u;
  // Handle protocol-relative URLs
  if(u.indexOf('//')===0){u=new URL(BASE).protocol+u;}
  // Handle absolute paths - resolve against BASE_ORIGIN
  if(u.indexOf('/')===0&&u.indexOf('//')!==0){
    u=BASE_ORIGIN+u;
  }
  // If it's a full URL, use it; otherwise resolve against BASE
  var resolved;
  try{
    var parsed=new URL(u);
    resolved=parsed.href;
  }catch(e){
    resolved=resolve(u,BASE);
  }
  return PREFIX+encode(resolved);
}

// Store for later use
window.__whisperRewrite=rewrite;
window.__whisperBase=BASE;
window.__whisperOrigin=BASE_ORIGIN;

// Override fetch
var _fetch=window.fetch;
window.fetch=function(input,init){
  try{
    if(typeof input==='string'){
      input=rewrite(input);
    }else if(input&&input.url){
      var newUrl=rewrite(input.url);
      input=new Request(newUrl,input);
    }
  }catch(e){}
  return _fetch.call(this,input,init);
};

// Override XMLHttpRequest
var _xhrOpen=XMLHttpRequest.prototype.open;
XMLHttpRequest.prototype.open=function(method,url){
  try{arguments[1]=rewrite(String(url));}catch(e){}
  return _xhrOpen.apply(this,arguments);
};

// Override createElement to intercept dynamic script/link/img creation
var _createElement=document.createElement.bind(document);
document.createElement=function(tag){
  var el=_createElement(tag);
  var t=(tag||'').toLowerCase();
  
  if(t==='script'){
    var realSrc='';
    Object.defineProperty(el,'src',{
      get:function(){return realSrc;},
      set:function(v){
        realSrc=v;
        try{
          var rewritten=rewrite(v);
          el.setAttribute('src',rewritten);
        }catch(e){
          el.setAttribute('src',v);
        }
      },
      configurable:true,enumerable:true
    });
  }
  
  if(t==='link'){
    var realHref='';
    Object.defineProperty(el,'href',{
      get:function(){return realHref;},
      set:function(v){
        realHref=v;
        try{
          var rewritten=rewrite(v);
          el.setAttribute('href',rewritten);
        }catch(e){
          el.setAttribute('href',v);
        }
      },
      configurable:true,enumerable:true
    });
  }
  
  if(t==='img'){
    var realImgSrc='';
    Object.defineProperty(el,'src',{
      get:function(){return realImgSrc;},
      set:function(v){
        realImgSrc=v;
        try{
          var rewritten=rewrite(v);
          el.setAttribute('src',rewritten);
        }catch(e){
          el.setAttribute('src',v);
        }
      },
      configurable:true,enumerable:true
    });
  }
  
  return el;
};

// Override setAttribute
var _setAttribute=Element.prototype.setAttribute;
Element.prototype.setAttribute=function(name,value){
  try{
    var n=(name||'').toLowerCase();
    if((n==='src'||n==='href'||n==='action'||n==='data'||n==='poster')&&typeof value==='string'){
      value=rewrite(value);
    }
  }catch(e){}
  return _setAttribute.call(this,name,value);
};

// Override window.open
var _windowOpen=window.open;
window.open=function(url,target,features){
  try{
    if(url&&typeof url==='string'){
      url=rewrite(url);
    }
  }catch(e){}
  return _windowOpen.call(this,url,target,features);
};

// Catch errors for resources that fail to load and retry through proxy
window.addEventListener('error',function(e){
  try{
    if(e.target&&e.target.tagName){
      var tag=e.target.tagName.toLowerCase();
      var attr=(tag==='link')?'href':'src';
      var val=e.target.getAttribute(attr);
      if(val&&!skip(val)){
        e.preventDefault();
        e.stopPropagation();
        e.target.setAttribute(attr,rewrite(val));
      }
    }
  }catch(err){}
},true);

// Spoof location properties
try{
  var fakeLocation={
    href:BASE,
    origin:BASE_ORIGIN,
    protocol:new URL(BASE).protocol,
    host:new URL(BASE).host,
    hostname:new URL(BASE).hostname,
    port:new URL(BASE).port,
    pathname:new URL(BASE).pathname,
    search:new URL(BASE).search,
    hash:new URL(BASE).hash
  };
  // Can't fully override location, but we can try
  Object.defineProperty(document,'domain',{
    get:function(){return new URL(BASE).hostname;},
    set:function(v){},
    configurable:true
  });
}catch(e){}

})();
<\/script>`;
}

interface Attribute {
    name: string;
    value: string;
}

interface Element {
    tagName: string;
    attrs: Attribute[];
    childNodes?: Node[];
    content?: DocumentFragment;
}

interface TextNode {
    value: string;
}

interface DocumentFragment {
    childNodes: Node[];
}

type Node = Element | TextNode | { nodeName: string; childNodes?: Node[] };

function isElement(node: Node): node is Element {
    return 'tagName' in node;
}

function isTextNode(node: Node): node is TextNode {
    return 'value' in node && !('tagName' in node);
}

function processNode(node: Node, base: string): void {
    if (isElement(node)) {
        const tag = node.tagName.toLowerCase();
        
        // Rewrite inline styles
        if (tag === 'style' && node.childNodes) {
            for (const child of node.childNodes) {
                if (isTextNode(child)) {
                    child.value = rewriteCss(child.value, base);
                }
            }
        }
        
        // Handle scripts - skip analytics, rewrite inline JS minimally
        if (tag === 'script') {
            const srcAttr = node.attrs.find(a => a.name === 'src');
            if (srcAttr && skipPatterns.some(p => p.test(srcAttr.value))) {
                srcAttr.value = 'data:text/javascript,//blocked';
            }
            // Don't rewrite inline script content - too risky
        }
        
        // Rewrite URL attributes
        for (const attr of node.attrs) {
            const name = attr.name.toLowerCase();
            
            if (urlAttrs.has(name)) {
                if (!shouldSkipUrl(attr.value)) {
                    attr.value = rewriteUrl(attr.value, base);
                }
            }
            
            if (srcsetAttrs.has(name)) {
                attr.value = rewriteSrcset(attr.value, base);
            }
            
            if (styleAttrs.has(name)) {
                attr.value = rewriteInlineStyle(attr.value, base);
            }
            
            // Handle meta refresh
            if (name === 'http-equiv' && tag === 'meta') {
                const contentAttr = node.attrs.find(a => a.name.toLowerCase() === 'content');
                if (contentAttr && attr.value.toLowerCase() === 'refresh') {
                    const match = contentAttr.value.match(/^(\d+;\s*url=)(.+)$/i);
                    if (match) {
                        contentAttr.value = match[1] + rewriteUrl(match[2], base);
                    }
                }
            }
            
            // Remove integrity and nonce
            if (name === 'integrity' || name === 'nonce') {
                attr.value = '';
            }
        }
        
        // Handle base tag
        if (tag === 'base') {
            const hrefAttr = node.attrs.find(a => a.name.toLowerCase() === 'href');
            if (hrefAttr) {
                // Don't rewrite, just clear it - our script handles resolution
                hrefAttr.value = '';
            }
        }
        
        // Process children
        if (node.childNodes) {
            for (const child of node.childNodes) {
                processNode(child, base);
            }
        }
        
        // Process template content
        if (tag === 'template' && node.content) {
            for (const child of node.content.childNodes) {
                processNode(child, base);
            }
        }
    }
}

function findHead(node: Node): Element | null {
    if (isElement(node)) {
        if (node.tagName.toLowerCase() === 'head') return node;
        if (node.childNodes) {
            for (const child of node.childNodes) {
                const found = findHead(child);
                if (found) return found;
            }
        }
    }
    return null;
}

function findHtml(node: Node): Element | null {
    if (isElement(node)) {
        if (node.tagName.toLowerCase() === 'html') return node;
        if (node.childNodes) {
            for (const child of node.childNodes) {
                const found = findHtml(child);
                if (found) return found;
            }
        }
    }
    return null;
}

export function rewriteHtml(html: string, base: string): string {
    try {
        const doc = parse5.parse(html, { sourceCodeLocationInfo: false }) as unknown as { childNodes: Node[] };
        
        // Process all nodes
        for (const node of doc.childNodes) {
            processNode(node, base);
        }
        
        // Inject client script at the very beginning of head
        const clientScript = createClientScript(base);
        const headNode = doc.childNodes.map(n => findHead(n)).find(Boolean);
        const htmlNode = doc.childNodes.map(n => findHtml(n)).find(Boolean);
        
        if (headNode && headNode.childNodes) {
            const scriptFragment = parse5.parseFragment(clientScript) as unknown as { childNodes: Node[] };
            headNode.childNodes.unshift(...scriptFragment.childNodes);
        } else if (htmlNode && htmlNode.childNodes) {
            const scriptFragment = parse5.parseFragment(clientScript) as unknown as { childNodes: Node[] };
            htmlNode.childNodes.unshift(...scriptFragment.childNodes);
        }
        
        return parse5.serialize(doc as unknown as parse5.DefaultTreeAdapterMap['document']);
    } catch (e) {
        // Fallback to regex-based rewriting
        return rewriteHtmlFallback(html, base);
    }
}

function rewriteHtmlFallback(html: string, base: string): string {
    let result = html;
    const clientScript = createClientScript(base);
    
    // Inject client script
    if (result.includes('<head>')) {
        result = result.replace('<head>', '<head>' + clientScript);
    } else if (result.includes('<head ')) {
        result = result.replace(/<head\s[^>]*>/, '$&' + clientScript);
    } else if (result.includes('<html>')) {
        result = result.replace('<html>', '<html>' + clientScript);
    } else if (result.includes('<html ')) {
        result = result.replace(/<html\s[^>]*>/, '$&' + clientScript);
    } else {
        result = clientScript + result;
    }
    
    // Rewrite attributes
    result = result.replace(/(href|src|action|data|poster|formaction)=["']([^"']+)["']/gi, (match, attr, url) => {
        if (shouldSkipUrl(url)) return match;
        const quote = match.includes('"') ? '"' : "'";
        return `${attr}=${quote}${rewriteUrl(url, base)}${quote}`;
    });
    
    // Rewrite srcset
    result = result.replace(/(srcset|imagesrcset)=["']([^"']+)["']/gi, (match, attr, srcset) => {
        const quote = match.includes('"') ? '"' : "'";
        return `${attr}=${quote}${rewriteSrcset(srcset, base)}${quote}`;
    });
    
    // Rewrite inline styles
    result = result.replace(/style=["']([^"']+)["']/gi, (match, style) => {
        const quote = match.includes('"') ? '"' : "'";
        return `style=${quote}${rewriteInlineStyle(style, base)}${quote}`;
    });
    
    // Remove integrity and nonce
    result = result.replace(/\s+integrity=["'][^"']*["']/gi, '');
    result = result.replace(/\s+nonce=["'][^"']*["']/gi, '');
    
    return result;
}

// JS rewriter - minimal changes to avoid breaking code
export function rewriteJs(js: string, base: string): string {
    // Don't modify JS at all - let client script handle everything
    // Modifying JS with regex is too error-prone
    return js;
}

export function rewriteManifest(manifest: string, base: string): string {
    try {
        const json = JSON.parse(manifest);
        const processValue = (obj: Record<string, unknown>, key: string): void => {
            if (typeof obj[key] === 'string' && !shouldSkipUrl(obj[key] as string)) {
                obj[key] = rewriteUrl(obj[key] as string, base);
            }
        };
        if (json.start_url) processValue(json, 'start_url');
        if (json.scope) processValue(json, 'scope');
        if (Array.isArray(json.icons)) {
            for (const icon of json.icons) {
                if (icon.src) processValue(icon, 'src');
            }
        }
        if (Array.isArray(json.screenshots)) {
            for (const ss of json.screenshots) {
                if (ss.src) processValue(ss, 'src');
            }
        }
        return JSON.stringify(json);
    } catch {
        return manifest;
    }
}

export function rewriteSvg(svg: string, base: string): string {
    return rewriteHtml(svg, base);
}
