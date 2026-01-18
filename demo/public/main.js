document.addEventListener('DOMContentLoaded', function () {
  const input = document.getElementById('urlInput');
  const btn = document.getElementById('goBtn');
  const status = document.getElementById('status');

  function setStatus(msg, err) {
    if (!status) return;
    status.textContent = msg;
    status.className = 'status' + (err ? ' error' : '');
  }

  btn.addEventListener('click', () => {
    const val = input.value.trim();
    if (!val) return setStatus('Please enter a URL', true);
    try {
      const u = new URL(val);
      const encoded = btoa(unescape(encodeURIComponent(u.toString())));
      const dest = `/proxy?url=${encodeURIComponent(encoded)}`;
      setStatus('Opening proxied site: ' + u.host);
      window.location.href = dest;
    } catch (e) {
      setStatus('Invalid URL', true);
    }
  });
});
