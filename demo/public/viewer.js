document.addEventListener('DOMContentLoaded', function(){
  const params = new URLSearchParams(window.location.search);
  const initial = params.get('url');
  const frame = document.getElementById('proxyFrame');
  const status = document.getElementById('status');
  const openBtn = document.getElementById('openBtn');
  const backBtn = document.getElementById('backBtn');
  const forwardBtn = document.getElementById('forwardBtn');
  const reloadBtn = document.getElementById('reloadBtn');
  const addr = document.getElementById('address');
  const goAddr = document.getElementById('goAddr');
  const allowCheckbox = document.getElementById('allowSameOrigin');

  const historyStack = [];
  let historyIndex = -1;

  function pushHistory(encoded) {
    if (historyIndex >= 0 && historyStack[historyIndex] === encoded) return;
    historyStack.splice(historyIndex + 1);
    historyStack.push(encoded);
    historyIndex = historyStack.length - 1;
    updateButtons();
  }

  function updateButtons(){
    if (backBtn) backBtn.disabled = historyIndex <= 0;
    if (forwardBtn) forwardBtn.disabled = historyIndex >= historyStack.length - 1;
  }

  function decodeBase64Safe(s){ try{ return decodeURIComponent(escape(atob(decodeURIComponent(s)))); }catch(e){ try{ return atob(s); }catch(e){ return s; } } }

  function loadEncoded(encoded, push=true){
    if(!encoded) return;
    const src = '/proxy?url=' + encoded;
    applySandbox();
    if(frame) frame.src = src;
    if(status) status.textContent = 'Loading...';
    if(push) pushHistory(encoded);
    if(addr) {
      try{ addr.value = decodeBase64Safe(encoded); }catch(e){ addr.value = encoded; }
    }
  }

  if(initial){ loadEncoded(initial, true); }
  if (initial) history.replaceState(null, '', window.location.pathname);

  function getSandboxString(){
    let s = 'allow-scripts allow-forms allow-popups allow-modals allow-top-navigation-by-user-activation';
    try{ if(allowCheckbox && allowCheckbox.checked) s += ' allow-same-origin'; }catch(e){}
    return s;
  }

  function applySandbox(){ try{ if(frame) frame.sandbox = getSandboxString(); }catch(e){} }

  try{
    const stored = localStorage.getItem('whisper_allow_same_origin');
    if(allowCheckbox){ allowCheckbox.checked = stored === '1'; allowCheckbox.addEventListener('change', ()=>{ try{ localStorage.setItem('whisper_allow_same_origin', allowCheckbox.checked ? '1' : '0'); applySandbox(); if(frame && frame.contentWindow) frame.contentWindow.location.reload(); else if(frame) frame.src = frame.src; }catch(e){} }); }
  }catch(e){}

  applySandbox();

  if(openBtn) openBtn.addEventListener('click', ()=>{ if(historyIndex>=0) window.open('/proxy?url=' + historyStack[historyIndex], '_blank'); });
  if(goAddr) goAddr.addEventListener('click', ()=>{
    const v = addr.value.trim(); if(!v) return; try{ const u = new URL(v); const enc = encodeURIComponent(btoa(unescape(encodeURIComponent(u.toString())))); loadEncoded(enc, true); }catch(e){ const enc = encodeURIComponent(btoa(unescape(encodeURIComponent(v)))); loadEncoded(enc, true); }
  });

  if(backBtn) backBtn.addEventListener('click', ()=>{ if(historyIndex>0){ historyIndex--; loadEncoded(historyStack[historyIndex], false); updateButtons(); } });
  if(forwardBtn) forwardBtn.addEventListener('click', ()=>{ if(historyIndex < historyStack.length -1){ historyIndex++; loadEncoded(historyStack[historyIndex], false); updateButtons(); } });
  if(reloadBtn) reloadBtn.addEventListener('click', ()=>{ try{ if(frame && frame.contentWindow) frame.contentWindow.location.reload(); }catch(e){ if(frame) frame.src = frame.src; } });

  if(frame){
    frame.addEventListener('load', ()=>{
      if(status) status.textContent = 'Loaded';
      try{
        const fw = frame.contentWindow;
        if(!fw) return;
        const sparams = new URLSearchParams(fw.location.search || '');
        const enc = sparams.get('url');
        if(enc){ if(historyIndex<0 || historyStack[historyIndex] !== enc) pushHistory(enc); if(addr) addr.value = decodeBase64Safe(enc); }
        try{ const t = fw.document && fw.document.title; if(t) status.textContent = t; }catch(e){}
      }catch(e){ }
    });
  }
  window.addEventListener('message', (ev)=>{
    try{
      const m = ev.data;
      if(m && m.type === 'whisper-open' && m.url){
        window.open(m.url, '_blank');
      }
    }catch(e){}
  });
});
