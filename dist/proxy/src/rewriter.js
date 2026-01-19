"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.Rewriter = exports.SvgRewriter = exports.ManifestRewriter = exports.JsRewriter = exports.InlineStyleRewriter = exports.CssRewriter = exports.HtmlRewriter = exports.UrlCodec = void 0;
exports.rewriteUrl = rewriteUrl;
exports.unrewriteUrl = unrewriteUrl;
exports.rewriteSrcset = rewriteSrcset;
exports.rewriteCss = rewriteCss;
exports.rewriteInlineStyle = rewriteInlineStyle;
exports.rewriteHtml = rewriteHtml;
exports.rewriteJs = rewriteJs;
exports.rewriteManifest = rewriteManifest;
exports.rewriteSvg = rewriteSvg;
const parse5 = __importStar(require("parse5"));
const csstree = __importStar(require("css-tree"));
const index_1 = require("../../shared/index");
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
function shouldSkipUrl(url) {
    if (!url)
        return true;
    const trimmed = url.trim();
    if (!trimmed)
        return true;
    if (trimmed.startsWith('data:'))
        return true;
    if (trimmed.startsWith('javascript:'))
        return true;
    if (trimmed.startsWith('blob:'))
        return true;
    if (trimmed.startsWith('about:'))
        return true;
    if (trimmed.startsWith('#'))
        return true;
    if (trimmed.startsWith('mailto:'))
        return true;
    if (trimmed.startsWith('tel:'))
        return true;
    if (trimmed.startsWith(index_1.config.prefix))
        return true;
    return skipPatterns.some(p => p.test(trimmed));
}
function resolveUrl(url, base) {
    try {
        return new URL(url, base).href;
    }
    catch {
        return url;
    }
}
function rewriteUrl(url, base) {
    if (shouldSkipUrl(url))
        return url;
    const resolved = resolveUrl(url, base);
    return index_1.config.prefix + (0, index_1.codecEncode)(resolved);
}
function unrewriteUrl(url) {
    if (url.startsWith(index_1.config.prefix)) {
        try {
            return (0, index_1.codecDecode)(url.slice(index_1.config.prefix.length));
        }
        catch {
            return url;
        }
    }
    return url;
}
function rewriteSrcset(srcset, base) {
    return srcset.split(',').map(entry => {
        const parts = entry.trim().split(/\s+/);
        if (parts.length === 0)
            return entry;
        const url = parts[0];
        if (!shouldSkipUrl(url)) {
            parts[0] = rewriteUrl(url, base);
        }
        return parts.join(' ');
    }).join(', ');
}
function rewriteCss(css, base) {
    return rewriteCssTree(css, base);
}
function rewriteCssTree(css, base) {
    try {
        const ast = csstree.parse(css, { parseValue: true, parseAtrulePrelude: true });
        csstree.walk(ast, (node) => {
            if (node.type === 'Url') {
                const urlNode = node;
                let value = '';
                const nodeValue = urlNode.value;
                if (nodeValue) {
                    if (typeof nodeValue === 'string') {
                        value = nodeValue;
                    }
                    else if (nodeValue.type === 'String') {
                        value = nodeValue.value.replace(/^['"]|['"]$/g, '');
                    }
                    else if (nodeValue.type === 'Raw') {
                        value = nodeValue.value;
                    }
                }
                if (value && !shouldSkipUrl(value)) {
                    const rewritten = rewriteUrl(value, base);
                    urlNode.value = { type: 'Raw', value: rewritten };
                }
            }
            if (node.type === 'Atrule') {
                const atrule = node;
                if (atrule.name === 'import' && atrule.prelude) {
                    if (atrule.prelude.type === 'AtrulePrelude') {
                        csstree.walk(atrule.prelude, (child) => {
                            if (child.type === 'String') {
                                const strNode = child;
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
    }
    catch {
        return rewriteCssFallback(css, base);
    }
}
function rewriteCssFallback(css, base) {
    let result = css;
    result = result.replace(/url\s*\(\s*(['"]?)([^'"\)]+)\1\s*\)/gi, (match, quote, url) => {
        const trimmedUrl = url.trim();
        if (shouldSkipUrl(trimmedUrl))
            return match;
        const rewritten = rewriteUrl(trimmedUrl, base);
        return `url(${quote}${rewritten}${quote})`;
    });
    result = result.replace(/@import\s+url\s*\(\s*(['"]?)([^'"\)]+)\1\s*\)/gi, (match, quote, url) => {
        const trimmedUrl = url.trim();
        if (shouldSkipUrl(trimmedUrl))
            return match;
        const rewritten = rewriteUrl(trimmedUrl, base);
        return `@import url(${quote}${rewritten}${quote})`;
    });
    result = result.replace(/@import\s+(['"])([^'"]+)\1/gi, (match, quote, url) => {
        if (shouldSkipUrl(url))
            return match;
        return `@import ${quote}${rewriteUrl(url, base)}${quote}`;
    });
    result = result.replace(/src\s*:\s*url\s*\(\s*(['"]?)([^'"\)]+)\1\s*\)/gi, (match, quote, url) => {
        const trimmedUrl = url.trim();
        if (shouldSkipUrl(trimmedUrl))
            return match;
        const rewritten = rewriteUrl(trimmedUrl, base);
        return `src:url(${quote}${rewritten}${quote})`;
    });
    return result;
}
function rewriteInlineStyle(style, base) {
    return style.replace(/url\s*\(\s*(['"]?)([^'"\)]+)\1\s*\)/gi, (match, quote, url) => {
        const trimmedUrl = url.trim();
        if (shouldSkipUrl(trimmedUrl))
            return match;
        return `url(${quote}${rewriteUrl(trimmedUrl, base)}${quote})`;
    });
}
function createClientScript(base) {
    const baseUrl = new URL(base);
    const baseOrigin = baseUrl.origin;
    const safeBase = base.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const safeOrigin = baseOrigin.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    return `<script data-whisper="client">
(function(){
'use strict';
var PREFIX='/proxy?url=';
var BASE='${safeBase}';
var BASE_ORIGIN='${safeOrigin}';
self.$envade$location=new URL(BASE);

function workerBootstrapClassic(proxied){
  return "(function(){'use strict';var PREFIX='/proxy?url=';var BASE='"+safeBase+"';function encode(s){try{return btoa(unescape(encodeURIComponent(s)));}catch(e){try{return btoa(s);}catch(e2){return s;}}}function resolve(u,b){try{return new URL(u,b).href;}catch(e){return u;}}function rewrite(u){if(!u||typeof u!=='string')return u;if(/^data:|^blob:|^javascript:|^about:|^mailto:|^tel:/.test(u))return u;if(u.indexOf('//')===0)u=new URL(BASE).protocol+u;if(u.indexOf('/')===0&&u.indexOf('//')!==0)u=new URL(BASE).origin+u;var resolved;try{resolved=new URL(u).href;}catch(e){resolved=resolve(u,BASE);}return PREFIX+encode(resolved);}var _fetch=self.fetch;self.fetch=function(i,n){try{if(typeof i==='string'){i=rewrite(i);}else if(i&&i.url){var nu=rewrite(i.url);i=new Request(nu,i);} }catch(e){}return _fetch.call(this,i,n)};if(self.XMLHttpRequest){var _open=XMLHttpRequest.prototype.open;XMLHttpRequest.prototype.open=function(m,u){try{arguments[1]=rewrite(String(u));}catch(e){}return _open.apply(this,arguments)};}var _imp=self.importScripts;if(_imp){self.importScripts=function(){try{var args=Array.prototype.slice.call(arguments).map(function(a){return rewrite(String(a))});return _imp.apply(self,args);}catch(e){return _imp.apply(self,arguments)}};} self.importScripts('"+proxied+"');})();";
}
function workerBootstrapModule(proxied){
  return "(async function(){'use strict';var PREFIX='/proxy?url=';var BASE='"+safeBase+"';function encode(s){try{return btoa(unescape(encodeURIComponent(s)));}catch(e){try{return btoa(s);}catch(e2){return s;}}}function resolve(u,b){try{return new URL(u,b).href;}catch(e){return u;}}function rewrite(u){if(!u||typeof u!=='string')return u;if(/^data:|^blob:|^javascript:|^about:|^mailto:|^tel:/.test(u))return u;if(u.indexOf('//')===0)u=new URL(BASE).protocol+u;if(u.indexOf('/')===0&&u.indexOf('//')!==0)u=new URL(BASE).origin+u;var resolved;try{resolved=new URL(u).href;}catch(e){resolved=resolve(u,BASE);}return PREFIX+encode(resolved);}var _fetch=self.fetch;self.fetch=function(i,n){try{if(typeof i==='string'){i=rewrite(i);}else if(i&&i.url){var nu=rewrite(i.url);i=new Request(nu,i);} }catch(e){}return _fetch.call(this,i,n)};if(self.XMLHttpRequest){var _open=XMLHttpRequest.prototype.open;XMLHttpRequest.prototype.open=function(m,u){try{arguments[1]=rewrite(String(u));}catch(e){}return _open.apply(this,arguments)};} await import('"+proxied+"');})();";
}

function wrapEnvStorage(storage){
  var sitePrefix='envade$'+self.$envade$location.host+'@';
  function keysForSite(){
    var keys=[];
    for(var i=0;i<storage.length;i++){
      var k=storage.key(i);
      if(k&&k.indexOf(sitePrefix)===0)keys.push(k);
    }
    return keys;
  }
  return new Proxy(storage,{
    get:function(target,prop){
      if(prop==='setItem')return function(key,value){target.setItem(sitePrefix+key,value);};
      if(prop==='getItem')return function(key){return target.getItem(sitePrefix+key);};
      if(prop==='removeItem')return function(key){target.removeItem(sitePrefix+key);};
      if(prop==='clear')return function(){keysForSite().forEach(function(k){target.removeItem(k);});};
      if(prop==='length')return keysForSite().length;
      if(prop==='key')return function(index){var keys=keysForSite();var k=keys[index];return k?k.slice(sitePrefix.length):null;};
      return target[prop];
    },
    ownKeys:function(){return keysForSite().map(function(k){return k.slice(sitePrefix.length);});},
    getOwnPropertyDescriptor:function(target,prop){
      if(typeof prop==='string'){
        var keys=keysForSite().map(function(k){return k.slice(sitePrefix.length);});
        if(keys.indexOf(prop)!==-1){
          return {configurable:true,enumerable:true,value:storage.getItem(sitePrefix+prop),writable:true};
        }
      }
      return undefined;
    }
  });
}
try{
  var envLocal=wrapEnvStorage(window.localStorage);
  var envSession=wrapEnvStorage(window.sessionStorage);
  Object.defineProperty(window,'localStorage',{value:envLocal,configurable:true,writable:false,enumerable:true});
  Object.defineProperty(window,'sessionStorage',{value:envSession,configurable:true,writable:false,enumerable:true});
}catch(e){}

try{
  window.postMessage=new Proxy(window.postMessage,{
    apply:function(target,thisArg,args){
      var msg=args[0], originArg=args[1], optionsArg=args[2];
      var payload=msg;
      if(typeof optionsArg==='object'&&optionsArg!=null){payload=optionsArg;}
      if(typeof payload==='object'&&payload!=null){
        try{
          var ctor=payload.constructor&&payload.constructor.constructor;
          if(typeof ctor==='function'){
            var selfObj=ctor('return self')();
            var callerOrigin=(selfObj.$envade$location&&selfObj.$envade$location.origin)||selfObj.location.origin;
            args[0]={env$type:'window',env$origin:callerOrigin,env$data:msg};
          }
        }catch(e){}
      }
      if(typeof originArg==='string'){args[1]='*';}
      else if(typeof originArg==='object'&&originArg!=null){args[1]=Object.assign({},originArg,{targetOrigin:'*'});}
      return Reflect.apply(target,thisArg,args);
    }
  });
}catch(e){}

try{
  var mpPost=MessagePort.prototype.postMessage;
  MessagePort.prototype.postMessage=new Proxy(mpPost,{
    apply:function(target,thisArg,args){
      var msg=args[0], optionsArg=args[1];
      var payload=optionsArg;
      if(typeof payload==='object'&&payload!=null){
        try{
          var ctor=payload.constructor&&payload.constructor.constructor;
          if(typeof ctor==='function'){
            var selfObj=ctor('return self')();
            var callerOrigin=(selfObj.$envade$location&&selfObj.$envade$location.origin)||selfObj.location.origin;
            args[0]={env$type:'messageport',env$origin:callerOrigin,env$data:msg};
          }
        }catch(e){}
      }
      return Reflect.apply(target,thisArg,args);
    }
  });
}catch(e){}

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
  var resolved;
  try{
    resolved=new URL(u).href;
  }catch(e){
    resolved=resolve(u,BASE);
  }
  return PREFIX+encode(resolved);
}

function GetLocation(){
  try{
    return window.location;
  }catch(e){
    return {href:BASE,origin:BASE_ORIGIN,toString:function(){return BASE;}};
  }
}

var locProxy={
  get href(){return GetLocation().href;},
  set href(url){
    if(typeof url==='string'&&url.indexOf(location.origin)===0){
      url=url.slice(location.origin.length);
    }
    location.href=rewrite(url);
  },
  get origin(){return BASE_ORIGIN;},
  get protocol(){return new URL(BASE).protocol;},
  set protocol(value){
    var u=new URL(GetLocation().href);
    u.protocol=value;
    location.href=rewrite(u.toString());
  },
  get host(){return new URL(BASE).host;},
  set host(value){
    var u=new URL(GetLocation().href);
    u.host=value;
    location.href=rewrite(u.toString());
  },
  get hostname(){return new URL(BASE).hostname;},
  set hostname(value){
    var u=new URL(GetLocation().href);
    u.hostname=value;
    location.href=rewrite(u.toString());
  },
  get port(){return new URL(BASE).port;},
  set port(value){
    var u=new URL(GetLocation().href);
    u.port=value;
    location.href=rewrite(u.toString());
  },
  get pathname(){return new URL(BASE).pathname;},
  set pathname(value){
    var u=new URL(GetLocation().href);
    u.pathname=value;
    location.href=rewrite(u.toString());
  },
  get search(){return new URL(BASE).search;},
  set search(value){
    var u=new URL(GetLocation().href);
    u.search=value;
    location.href=rewrite(u.toString());
  },
  get hash(){return new URL(BASE).hash;},
  set hash(value){
    var u=new URL(GetLocation().href);
    u.hash=value;
    location.href=rewrite(u.toString());
  },
  toString:function(){return GetLocation().href;},
  valueOf:function(){return GetLocation().href;},
  assign:function(url){location.assign(rewrite(String(url)));},
  replace:function(url){location.replace(rewrite(String(url)));},
  reload:function(){location.reload();}
};

function createStorageWrapper(storage){
  var sitePrefix='__whisper$'+new URL(BASE).host+'@';
  function keysForSite(){
    var keys=[];
    for(var i=0;i<storage.length;i++){
      var k=storage.key(i);
      if(k&&k.indexOf(sitePrefix)===0)keys.push(k);
    }
    return keys;
  }
  return new Proxy(storage,{
    get:function(target,prop){
      if(prop==='setItem')return function(key,value){target.setItem(sitePrefix+key,value);};
      if(prop==='getItem')return function(key){return target.getItem(sitePrefix+key);};
      if(prop==='removeItem')return function(key){target.removeItem(sitePrefix+key);};
      if(prop==='clear')return function(){keysForSite().forEach(function(k){target.removeItem(k);});};
      if(prop==='length')return keysForSite().length;
      if(prop==='key')return function(index){var keys=keysForSite();var k=keys[index];return k?k.slice(sitePrefix.length):null;};
      return target[prop];
    },
    ownKeys:function(){
      return keysForSite().map(function(k){return k.slice(sitePrefix.length);});
    },
    getOwnPropertyDescriptor:function(target,prop){
      if(typeof prop==='string'){
        var keys=keysForSite().map(function(k){return k.slice(sitePrefix.length);});
        if(keys.indexOf(prop)!==-1){
          return {configurable:true,enumerable:true,value:storage.getItem(sitePrefix+prop),writable:true};
        }
      }
      return undefined;
    }
  });
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

try{
  var wrappedLocal=createStorageWrapper(window.localStorage);
  var wrappedSession=createStorageWrapper(window.sessionStorage);
  Object.defineProperty(window,'localStorage',{value:wrappedLocal,configurable:true,writable:false,enumerable:true});
  Object.defineProperty(window,'sessionStorage',{value:wrappedSession,configurable:true,writable:false,enumerable:true});
}catch(e){}

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

var _sendBeacon=navigator.sendBeacon;
if(_sendBeacon){
  navigator.sendBeacon=function(url,data){
    try{
      if(typeof url==='string'){
        url=rewrite(url);
      }
    }catch(e){}
    return _sendBeacon.call(this,url,data);
  };
}

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
                try{
                    var rel=(el.getAttribute('rel')||'').toLowerCase();
                    if(rel==='preload'||rel==='modulepreload'){
                        el.setAttribute('href',realHref);
                    }else{
                        el.setAttribute('href',rewrite(realHref));
                    }
                }
                catch(e){el.setAttribute('href',realHref);}
      },
      configurable:true,enumerable:true
    });
  }
  
  if(t==='iframe'){
    var realIframeSrc='';
    Object.defineProperty(el,'src',{
      get:function(){return realIframeSrc;},
      set:function(v){
        realIframeSrc=v==null?'':String(v);
        try{el.setAttribute('src',rewrite(realIframeSrc));}
        catch(e){el.setAttribute('src',realIframeSrc);}
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
function __whisperShouldBlob(el,n){
  var t=(el.tagName||'').toLowerCase();
  if(n==='href'){
    var rel=(el.getAttribute&&el.getAttribute('rel')||'').toLowerCase();
    if(t==='link'&&rel==='stylesheet')return true;
    return false;
  }
  if(n==='src'){
    if(t==='script'||t==='img'||t==='video'||t==='audio'||t==='source'||t==='track')return true;
    return false;
  }
  if(n==='poster'){
    if(t==='video')return true;
    return false;
  }
  if(n==='data'){
    if(t==='object')return true;
    return false;
  }
  return false;
}
function __whisperBlobify(el,n){
  try{
    var v=el.getAttribute(n);
    if(!v||v.indexOf('blob:')===0||v.indexOf('data:')===0)return;
    if(v.indexOf(PREFIX)!==0)return;
    fetch(v,{method:'GET'}).then(function(r){return r.blob();}).then(function(b){
      var u=URL.createObjectURL(b);
      _setAttribute.call(el,n,u);
    }).catch(function(){});
  }catch(e){}
}
Element.prototype.setAttribute=function(name,value){
  try{
    var n=(name||'').toLowerCase();
        if(value!=null){
            var str=String(value);
            if(n==='src'||n==='href'||n==='action'||n==='data'||n==='poster'){
                var rel=(this.getAttribute&&this.getAttribute('rel')||'').toLowerCase();
                if(n==='href'&&(rel==='preload'||rel==='modulepreload')){
                    value=str;
                }else{
                    value=rewrite(str);
                }
            }else if(n==='srcset'||n==='imagesrcset'){
                value=rewriteSrcset(str);
            }else if(n==='style'){
                value=rewriteStyle(str);
            }
        }
  }catch(e){}
  var r=_setAttribute.call(this,name,value);
  try{
    var n2=(name||'').toLowerCase();
    if(__whisperShouldBlob(this,n2))__whisperBlobify(this,n2);
  }catch(e){}
  return r;
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
var __whisperScan=function(){
  try{
    var list=[];
    list=list.concat(Array.prototype.slice.call(document.querySelectorAll('script[src]')));
    list=list.concat(Array.prototype.slice.call(document.querySelectorAll('link[rel=stylesheet][href]')));
    list=list.concat(Array.prototype.slice.call(document.querySelectorAll('img[src]')));
    list=list.concat(Array.prototype.slice.call(document.querySelectorAll('video[src]')));
    list=list.concat(Array.prototype.slice.call(document.querySelectorAll('audio[src]')));
    list=list.concat(Array.prototype.slice.call(document.querySelectorAll('source[src]')));
    list=list.concat(Array.prototype.slice.call(document.querySelectorAll('track[src]')));
    list=list.concat(Array.prototype.slice.call(document.querySelectorAll('object[data]')));
    list=list.concat(Array.prototype.slice.call(document.querySelectorAll('video[poster]')));
    for(var i=0;i<list.length;i++){
      var el=list[i];
      var attr='src';
      var t=(el.tagName||'').toLowerCase();
      if(t==='link')attr='href';
      if(t==='object')attr='data';
      if(t==='video'&&el.getAttribute('poster')){__whisperBlobify(el,'poster');}
      __whisperBlobify(el,attr);
    }
  }catch(e){}
};
try{__whisperScan();}catch(e){}
try{
  var mo=new MutationObserver(function(records){
    for(var i=0;i<records.length;i++){
      var rec=records[i];
      if(rec.type==='attributes'){
        var el=rec.target;
        var n=rec.attributeName;
        if(__whisperShouldBlob(el,n))__whisperBlobify(el,n);
      }else if(rec.type==='childList'){
        var nodes=rec.addedNodes;
        for(var j=0;j<nodes.length;j++){
          var node=nodes[j];
          if(node&&node.querySelectorAll){
            var els=node.querySelectorAll('script[src],link[rel=stylesheet][href],img[src],video[src],audio[src],source[src],track[src],object[data]');
            for(var k=0;k<els.length;k++){
              var e2=els[k];
              var attr='src';
              var tt=(e2.tagName||'').toLowerCase();
              if(tt==='link')attr='href';
              if(tt==='object')attr='data';
              __whisperBlobify(e2,attr);
            }
          }
        }
      }
    }
  });
  mo.observe(document.documentElement||document,{attributes:true,attributeFilter:['src','href','poster','data'],subtree:true,childList:true});
}catch(e){}

document.addEventListener('click',function(e){
  try{
    var t=e.target;
    while(t&&t.tagName&&t.tagName.toLowerCase()!=='a'){t=t.parentNode;}
    if(!t||!t.tagName)return;
    var href=t.getAttribute('href');
    if(!href||skip(href))return;
    var rewritten=rewrite(href);
    var tgt=(t.getAttribute('target')||'').toLowerCase();
    e.preventDefault();
    if(tgt==='_blank'){window.open(rewritten,'_blank');}
    else{location.href=rewritten;}
  }catch(err){}
},true);

document.addEventListener('auxclick',function(e){
  try{
    var t=e.target;
    while(t&&t.tagName&&t.tagName.toLowerCase()!=='a'){t=t.parentNode;}
    if(!t||!t.tagName)return;
    var href=t.getAttribute('href');
    if(!href||skip(href))return;
    var rewritten=rewrite(href);
    e.preventDefault();
    window.open(rewritten,'_blank');
  }catch(err){}
},true);

document.addEventListener('mousedown',function(e){
  try{
    var t=e.target;
    while(t&&t.tagName&&t.tagName.toLowerCase()!=='a'){t=t.parentNode;}
    if(!t||!t.tagName)return;
    var href=t.getAttribute('href');
    if(!href||skip(href))return;
    t.setAttribute('href',rewrite(href));
  }catch(err){}
},true);

document.addEventListener('submit',function(e){
  try{
    var f=e.target;
    if(f&&typeof f.getAttribute==='function'){
      var act=f.getAttribute('action');
      if(act&&!skip(act))f.setAttribute('action',rewrite(act));
    }
  }catch(err){}
},true);

try{
  if(navigator.serviceWorker&&navigator.serviceWorker.register){
    var _swRegister=navigator.serviceWorker.register.bind(navigator.serviceWorker);
    navigator.serviceWorker.register=function(scriptURL,options){
      try{scriptURL=rewrite(String(scriptURL));}catch(e){}
      return _swRegister(scriptURL,options);
    };
  }
}catch(e){}

try{
  var _Worker=window.Worker;
  if(_Worker){
    var _WorkerCtor=_Worker;
    window.Worker=function(scriptURL,options){
      try{
        var proxied=rewrite(String(scriptURL));
        var isModule=options&&String(options.type).toLowerCase()==='module';
        var code=isModule?workerBootstrapModule(proxied):workerBootstrapClassic(proxied);
        var blob=new Blob([code],{type:'application/javascript'});
        var blobURL=URL.createObjectURL(blob);
        var opts=options?Object.assign({},options,{type:isModule?'module':undefined}):undefined;
        return new _WorkerCtor(blobURL,opts);
      }catch(e){
        try{scriptURL=rewrite(String(scriptURL));}catch(_){}
        return new _WorkerCtor(scriptURL,options);
      }
    };
  }
}catch(e){}

try{
  var _SharedWorker=window.SharedWorker;
  if(_SharedWorker){
    var _SharedWorkerCtor=_SharedWorker;
    window.SharedWorker=function(scriptURL,options){
      try{
        var proxied=rewrite(String(scriptURL));
        var isModule=options&&String(options.type).toLowerCase()==='module';
        var code=isModule?workerBootstrapModule(proxied):workerBootstrapClassic(proxied);
        var blob=new Blob([code],{type:'application/javascript'});
        var blobURL=URL.createObjectURL(blob);
        return new _SharedWorkerCtor(blobURL,options);
      }catch(e){
        try{scriptURL=rewrite(String(scriptURL));}catch(_){}
        return new _SharedWorkerCtor(scriptURL,options);
      }
    };
  }
}catch(e){}

try{
  var _EventSource=window.EventSource;
  if(_EventSource){
    var _EventSourceCtor=_EventSource;
    window.EventSource=function(url,conf){
      try{url=rewrite(String(url));}catch(e){}
      return new _EventSourceCtor(url,conf);
    };
  }
}catch(e){}

window.addEventListener('error',function(e){
  try{
    if(e.target&&e.target.tagName){
      var tag=e.target.tagName.toLowerCase();
      var attr=(tag==='link')?'href':'src';
      var val=e.target.getAttribute(attr);
      if(val&&!skip(val)){
        try{
          e.preventDefault();
          e.stopPropagation();
        }catch(_){}
        try{
          if(tag==='iframe'){
            var proxied=rewrite(val);
            fetch(proxied,{method:'GET'}).then(function(r){return r.text();}).then(function(html){
              try{
                e.target.removeAttribute('src');
                e.target.setAttribute('srcdoc',html);
              }catch(_){}
            }).catch(function(){
              try{e.target.setAttribute(attr,rewrite(val));}catch(_){}
            });
          }else{
            e.target.setAttribute(attr,rewrite(val));
          }
        }catch(_){}
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

try{
  Object.defineProperty(document,'cookie',{
    get:function(){return '';},
    set:function(v){},
    configurable:true
  });
}catch(e){}

try{
  Object.defineProperty(window,'location',{
    get:function(){return locProxy;},
    set:function(v){
      if(typeof v==='string'){
        locProxy.href=v;
      }
    }
  });
}catch(e){}

try{
  Object.defineProperty(document,'location',{
    get:function(){return locProxy;},
    set:function(v){
      if(typeof v==='string'){
        locProxy.href=v;
      }
    }
  });
}catch(e){}

try{
  window.$whisperLocation={
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
}catch(e){}

})();
</script>`;
}
function isElement(node) {
    return 'tagName' in node;
}
function isTextNode(node) {
    return 'value' in node && !('tagName' in node);
}
function processNode(node, base) {
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
        if (tag === 'iframe') {
            const sandboxIndex = node.attrs.findIndex(a => a.name.toLowerCase() === 'sandbox');
            if (sandboxIndex !== -1) {
                node.attrs.splice(sandboxIndex, 1);
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
function findHead(node) {
    if (isElement(node)) {
        if (node.tagName.toLowerCase() === 'head')
            return node;
        if (node.childNodes) {
            for (const child of node.childNodes) {
                const found = findHead(child);
                if (found)
                    return found;
            }
        }
    }
    return null;
}
function findHtml(node) {
    if (isElement(node)) {
        if (node.tagName.toLowerCase() === 'html')
            return node;
        if (node.childNodes) {
            for (const child of node.childNodes) {
                const found = findHtml(child);
                if (found)
                    return found;
            }
        }
    }
    return null;
}
function rewriteHtml(html, base) {
    try {
        const doc = parse5.parse(html, { sourceCodeLocationInfo: false });
        for (const node of doc.childNodes) {
            processNode(node, base);
        }
        const clientScript = createClientScript(base);
        const headNode = doc.childNodes.map(n => findHead(n)).find(Boolean);
        const htmlNode = doc.childNodes.map(n => findHtml(n)).find(Boolean);
        if (headNode && headNode.childNodes) {
            const scriptFragment = parse5.parseFragment(clientScript);
            headNode.childNodes.unshift(...scriptFragment.childNodes);
        }
        else if (htmlNode && htmlNode.childNodes) {
            const scriptFragment = parse5.parseFragment(clientScript);
            htmlNode.childNodes.unshift(...scriptFragment.childNodes);
        }
        return parse5.serialize(doc);
    }
    catch (e) {
        return rewriteHtmlFallback(html, base);
    }
}
function rewriteHtmlFallback(html, base) {
    let result = html;
    const clientScript = createClientScript(base);
    if (result.includes('<head>')) {
        result = result.replace('<head>', '<head>' + clientScript);
    }
    else if (result.includes('<head ')) {
        result = result.replace(/<head\s[^>]*>/, '$&' + clientScript);
    }
    else if (result.includes('<html>')) {
        result = result.replace('<html>', '<html>' + clientScript);
    }
    else if (result.includes('<html ')) {
        result = result.replace(/<html\s[^>]*>/, '$&' + clientScript);
    }
    else {
        result = clientScript + result;
    }
    result = result.replace(/(href|src|action|data|poster|formaction)=["']([^"']+)["']/gi, (match, attr, url) => {
        if (shouldSkipUrl(url))
            return match;
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
function rewriteJs(js, base) {
    let result = js;
    const isResolvable = (spec) => {
        const s = spec.trim();
        if (!s)
            return false;
        if (/^(data:|blob:|javascript:|mailto:|tel:)/i.test(s))
            return false;
        return s.startsWith('/') || s.startsWith('./') || s.startsWith('../') || /^[a-z]+:\/\//i.test(s) || s.startsWith('//');
    };
    const replaceSpecifier = (match, quote, spec) => {
        if (!isResolvable(spec) || shouldSkipUrl(spec))
            return match;
        const rewritten = rewriteUrl(spec, base);
        return match.replace(`${quote}${spec}${quote}`, `${quote}${rewritten}${quote}`);
    };
    result = result.replace(/\bimport\s+(['"])([^'"]+)\1/g, replaceSpecifier);
    result = result.replace(/\bfrom\s+(['"])([^'"]+)\1/g, replaceSpecifier);
    result = result.replace(/\bexport\s+[^;]*?\sfrom\s+(['"])([^'"]+)\1/g, replaceSpecifier);
    result = result.replace(/\bimport\s*\(\s*(['"])([^'"]+)\1\s*\)/g, replaceSpecifier);
    result = result.replace(/\bnew\s+(?:Shared)?Worker\s*\(\s*(['"])([^'"]+)\1/g, replaceSpecifier);
    result = result.replace(/\bserviceWorker\.register\s*\(\s*(['"])([^'"]+)\1/g, replaceSpecifier);
    result = result.replace(/\bimportScripts\s*\(([^)]*)\)/g, (m, args) => {
        const replaced = String(args).replace(/(['"])([^'"]+)\1/g, (mm, q, spec) => {
            if (!isResolvable(spec) || shouldSkipUrl(spec))
                return mm;
            const rewritten = rewriteUrl(spec, base);
            return `${q}${rewritten}${q}`;
        });
        return `importScripts(${replaced})`;
    });
    result = result.replace(/\bnew\s+URL\s*\(\s*(['"])([^'"]+)\1\s*,\s*import\.meta\.url\s*\)/g, (m, q, spec) => {
        if (!isResolvable(spec) || shouldSkipUrl(spec))
            return m;
        const rewritten = rewriteUrl(spec, base);
        return m.replace(`${q}${spec}${q}`, `${q}${rewritten}${q}`);
    });
    return result;
}
function rewriteManifest(manifest, base) {
    try {
        const json = JSON.parse(manifest);
        const processValue = (obj, key) => {
            if (typeof obj[key] === 'string' && !shouldSkipUrl(obj[key])) {
                obj[key] = rewriteUrl(obj[key], base);
            }
        };
        if (json.start_url)
            processValue(json, 'start_url');
        if (json.scope)
            processValue(json, 'scope');
        if (Array.isArray(json.icons)) {
            for (const icon of json.icons) {
                if (icon.src)
                    processValue(icon, 'src');
            }
        }
        if (Array.isArray(json.screenshots)) {
            for (const ss of json.screenshots) {
                if (ss.src)
                    processValue(ss, 'src');
            }
        }
        return JSON.stringify(json);
    }
    catch {
        return manifest;
    }
}
function rewriteSvg(svg, base) {
    return rewriteHtml(svg, base);
}
class UrlCodec {
    constructor(prefix) { this.prefix = prefix; }
    encode(u) { return index_1.config.prefix + (0, index_1.codecEncode)(u); }
    decode(u) { return (0, index_1.codecDecode)(u); }
}
exports.UrlCodec = UrlCodec;
class HtmlRewriter {
    constructor(base) { this.base = base; }
    rewrite(input) { return rewriteHtml(input, this.base); }
    clientScript() { return createClientScript(this.base); }
}
exports.HtmlRewriter = HtmlRewriter;
class CssRewriter {
    constructor(base) { this.base = base; }
    rewrite(input) { return rewriteCss(input, this.base); }
}
exports.CssRewriter = CssRewriter;
class InlineStyleRewriter {
    constructor(base) { this.base = base; }
    rewrite(input) { return rewriteInlineStyle(input, this.base); }
}
exports.InlineStyleRewriter = InlineStyleRewriter;
class JsRewriter {
    constructor(base) { this.base = base; }
    rewrite(input) { return rewriteJs(input, this.base); }
}
exports.JsRewriter = JsRewriter;
class ManifestRewriter {
    constructor(base) { this.base = base; }
    rewrite(input) { return rewriteManifest(input, this.base); }
}
exports.ManifestRewriter = ManifestRewriter;
class SvgRewriter {
    constructor(base) { this.base = base; }
    rewrite(input) { return rewriteSvg(input, this.base); }
}
exports.SvgRewriter = SvgRewriter;
class Rewriter {
    constructor(base) {
        this.html = new HtmlRewriter(base);
        this.css = new CssRewriter(base);
        this.js = new JsRewriter(base);
        this.manifest = new ManifestRewriter(base);
        this.svg = new SvgRewriter(base);
    }
}
exports.Rewriter = Rewriter;
