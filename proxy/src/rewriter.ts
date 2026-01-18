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
    // Always use regex-based fallback for reliability
    // css-tree can sometimes not handle all edge cases
    return rewriteCssFallback(css, base);
}

function rewriteCssTree(css: string, base: string): string {
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
    
    // Handle url() with various quote styles and whitespace
    // Match: url("..."), url('...'), url(...), url( "..." ), etc.
    result = result.replace(/url\s*\(\s*(['"]?)([^'"\)]+)\1\s*\)/gi, (match, quote, url) => {
        const trimmedUrl = url.trim();
        if (shouldSkipUrl(trimmedUrl)) return match;
        const rewritten = rewriteUrl(trimmedUrl, base);
        return `url(${quote}${rewritten}${quote})`;
    });
    
    // Handle @import with url()
    result = result.replace(/@import\s+url\s*\(\s*(['"]?)([^'"\)]+)\1\s*\)/gi, (match, quote, url) => {
        const trimmedUrl = url.trim();
        if (shouldSkipUrl(trimmedUrl)) return match;
        const rewritten = rewriteUrl(trimmedUrl, base);
        return `@import url(${quote}${rewritten}${quote})`;
    });
    
    // Handle @import with string
    result = result.replace(/@import\s+(['"])([^'"]+)\1/gi, (match, quote, url) => {
        if (shouldSkipUrl(url)) return match;
        return `@import ${quote}${rewriteUrl(url, base)}${quote}`;
    });
    
    // Handle src: url() in @font-face
    result = result.replace(/src\s*:\s*url\s*\(\s*(['"]?)([^'"\)]+)\1\s*\)/gi, (match, quote, url) => {
        const trimmedUrl = url.trim();
        if (shouldSkipUrl(trimmedUrl)) return match;
        const rewritten = rewriteUrl(trimmedUrl, base);
        return `src:url(${quote}${rewritten}${quote})`;
    });
    
    return result;
}

export function rewriteInlineStyle(style: string, base: string): string {
    return style.replace(/url\s*\(\s*(['"]?)([^'"\)]+)\1\s*\)/gi, (match, quote, url) => {
        const trimmedUrl = url.trim();
        if (shouldSkipUrl(trimmedUrl)) return match;
        return `url(${quote}${rewriteUrl(trimmedUrl, base)}${quote})`;
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

function encode(str){
  try{return btoa(unescape(encodeURIComponent(str)));}
  catch(e){try{return btoa(str);}catch(e2){return str;}}
}

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

function resolve(u,b){
  try{return new URL(u,b).href;}
  catch(e){return u;}
}

function rewrite(u){
  if(skip(u))return u;
  if(u.indexOf('//')===0){u=new URL(BASE).protocol+u;}
  if(u.indexOf('/')===0&&u.indexOf('//')!==0){
    u=BASE_ORIGIN+u;
  }
  var resolved;
  try{
    var parsed=new URL(u);
    resolved=parsed.href;
  }catch(e){
    resolved=resolve(u,BASE);
  }
  return PREFIX+encode(resolved);
}

function rewriteSrcset(value){
    if(!value||typeof value!=='string')return value;
    return value.split(',').map(function(entry){
        var parts=entry.trim().split(/\s+/);
        if(!parts.length)return entry;
        var url=parts[0];
        if(!skip(url))parts[0]=rewrite(url);
        return parts.join(' ');
    }).join(', ');
}

function rewriteStyle(value){
    if(!value||typeof value!=='string')return value;
        return value.replace(/url\s*\(\s*(['"]?)([^'"\)]+)\\1\s*\)/gi,function(match,quote,url){
        if(skip(url))return match;
        return 'url('+quote+rewrite(url)+quote+')';
    });
}

function hookProp(proto,prop){
    try{
        var desc=Object.getOwnPropertyDescriptor(proto,prop);
        if(!desc||!desc.set||!desc.get)return;
        Object.defineProperty(proto,prop,{
            get:function(){return desc.get.call(this);},
            set:function(v){
                try{
                    var str=v==null?'':String(v);
                    str=rewrite(str);
                    return desc.set.call(this,str);
                }catch(e){
                    return desc.set.call(this,v);
                }
            },
            configurable:true,
            enumerable:desc.enumerable
        });
    }catch(e){}
}

window.__whisperRewrite=rewrite;
window.__whisperBase=BASE;
window.__whisperOrigin=BASE_ORIGIN;

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

var _xhrOpen=XMLHttpRequest.prototype.open;
XMLHttpRequest.prototype.open=function(method,url){
  try{arguments[1]=rewrite(String(url));}catch(e){}
  return _xhrOpen.apply(this,arguments);
};

var _createElement=document.createElement.bind(document);
document.createElement=function(tag){
  var el=_createElement(tag);
  var t=(tag||'').toLowerCase();
  
  if(t==='script'){
    var realSrc='';
    Object.defineProperty(el,'src',{
      get:function(){return realSrc;},
      set:function(v){
                realSrc=v==null?'':String(v);
                try{el.setAttribute('src',rewrite(realSrc));}
                catch(e){el.setAttribute('src',realSrc);}
      },
      configurable:true,enumerable:true
    });
  }
  
  if(t==='link'){
    var realHref='';
    Object.defineProperty(el,'href',{
      get:function(){return realHref;},
      set:function(v){
                realHref=v==null?'':String(v);
                try{el.setAttribute('href',rewrite(realHref));}
                catch(e){el.setAttribute('href',realHref);}
      },
      configurable:true,enumerable:true
    });
  }
  
  if(t==='img'){
    var realImgSrc='';
    Object.defineProperty(el,'src',{
      get:function(){return realImgSrc;},
      set:function(v){
                realImgSrc=v==null?'':String(v);
                try{el.setAttribute('src',rewrite(realImgSrc));}
                catch(e){el.setAttribute('src',realImgSrc);}
      },
      configurable:true,enumerable:true
    });
  }
  
  return el;
};

var _setAttribute=Element.prototype.setAttribute;
Element.prototype.setAttribute=function(name,value){
  try{
    var n=(name||'').toLowerCase();
        if(value!=null){
            var str=String(value);
            if(n==='src'||n==='href'||n==='action'||n==='data'||n==='poster'){
                value=rewrite(str);
            }else if(n==='srcset'||n==='imagesrcset'){
                value=rewriteSrcset(str);
            }else if(n==='style'){
                value=rewriteStyle(str);
            }
        }
  }catch(e){}
  return _setAttribute.call(this,name,value);
};

try{
    hookProp(HTMLImageElement.prototype,'src');
    hookProp(HTMLImageElement.prototype,'srcset');
    hookProp(HTMLScriptElement.prototype,'src');
    hookProp(HTMLLinkElement.prototype,'href');
    hookProp(HTMLAnchorElement.prototype,'href');
    hookProp(HTMLIFrameElement.prototype,'src');
    hookProp(HTMLVideoElement.prototype,'src');
    hookProp(HTMLVideoElement.prototype,'poster');
    hookProp(HTMLAudioElement.prototype,'src');
    hookProp(HTMLSourceElement.prototype,'src');
    hookProp(HTMLSourceElement.prototype,'srcset');
    hookProp(HTMLTrackElement.prototype,'src');
    hookProp(HTMLFormElement.prototype,'action');
    hookProp(HTMLInputElement.prototype,'src');
}catch(e){}

try{
    var _assign=Location.prototype.assign;
    var _replace=Location.prototype.replace;
    Location.prototype.assign=function(url){
        return _assign.call(this,rewrite(String(url)));
    };
    Location.prototype.replace=function(url){
        return _replace.call(this,rewrite(String(url)));
    };
    var hrefDesc=Object.getOwnPropertyDescriptor(Location.prototype,'href');
    if(hrefDesc&&hrefDesc.set&&hrefDesc.get){
        Object.defineProperty(Location.prototype,'href',{
            get:function(){return hrefDesc.get.call(this);},
            set:function(v){
                try{if(typeof v==='string')v=rewrite(v);}catch(e){}
                return hrefDesc.set.call(this,v);
            },
            configurable:true,
            enumerable:hrefDesc.enumerable
        });
    }
}catch(e){}

try{
    var _pushState=history.pushState;
    var _replaceState=history.replaceState;
    history.pushState=function(state,title,url){
        if(url&&typeof url==='string')url=rewrite(url);
        return _pushState.call(this,state,title,url);
    };
    history.replaceState=function(state,title,url){
        if(url&&typeof url==='string')url=rewrite(url);
        return _replaceState.call(this,state,title,url);
    };
}catch(e){}

var _windowOpen=window.open;
window.open=function(url,target,features){
  try{
    if(url&&typeof url==='string'){
      url=rewrite(url);
    }
  }catch(e){}
  return _windowOpen.call(this,url,target,features);
};

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

try{
  Object.defineProperty(document,'domain',{
    get:function(){return new URL(BASE).hostname;},
    set:function(v){},
    configurable:true
  });
}catch(e){}

})();
</script>`;
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
        
        if (tag === 'style' && node.childNodes) {
            for (const child of node.childNodes) {
                if (isTextNode(child)) {
                    child.value = rewriteCss(child.value, base);
                }
            }
        }
        
        if (tag === 'script') {
            const srcAttr = node.attrs.find(a => a.name === 'src');
            if (srcAttr && skipPatterns.some(p => p.test(srcAttr.value))) {
                srcAttr.value = 'data:text/javascript,//blocked';
            }
        }
        
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
            
            if (name === 'http-equiv' && tag === 'meta') {
                const contentAttr = node.attrs.find(a => a.name.toLowerCase() === 'content');
                if (contentAttr && attr.value.toLowerCase() === 'refresh') {
                    const match = contentAttr.value.match(/^(\d+;\s*url=)(.+)$/i);
                    if (match) {
                        contentAttr.value = match[1] + rewriteUrl(match[2], base);
                    }
                }
            }
            
            if (name === 'integrity' || name === 'nonce') {
                attr.value = '';
            }
        }
        
        if (tag === 'base') {
            const hrefAttr = node.attrs.find(a => a.name.toLowerCase() === 'href');
            if (hrefAttr) {
                hrefAttr.value = '';
            }
        }
        
        if (node.childNodes) {
            for (const child of node.childNodes) {
                processNode(child, base);
            }
        }
        
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
        
        for (const node of doc.childNodes) {
            processNode(node, base);
        }
        
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
        return rewriteHtmlFallback(html, base);
    }
}

function rewriteHtmlFallback(html: string, base: string): string {
    let result = html;
    const clientScript = createClientScript(base);
    
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
    
    result = result.replace(/(href|src|action|data|poster|formaction)=["']([^"']+)["']/gi, (match, attr, url) => {
        if (shouldSkipUrl(url)) return match;
        const quote = match.includes('"') ? '"' : "'";
        return `${attr}=${quote}${rewriteUrl(url, base)}${quote}`;
    });
    
    result = result.replace(/(srcset|imagesrcset)=["']([^"']+)["']/gi, (match, attr, srcset) => {
        const quote = match.includes('"') ? '"' : "'";
        return `${attr}=${quote}${rewriteSrcset(srcset, base)}${quote}`;
    });
    
    result = result.replace(/style=["']([^"']+)["']/gi, (match, style) => {
        const quote = match.includes('"') ? '"' : "'";
        return `style=${quote}${rewriteInlineStyle(style, base)}${quote}`;
    });
    
    result = result.replace(/\s+integrity=["'][^"']*["']/gi, '');
    result = result.replace(/\s+nonce=["'][^"']*["']/gi, '');
    
    return result;
}

export function rewriteJs(js: string, base: string): string {
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
