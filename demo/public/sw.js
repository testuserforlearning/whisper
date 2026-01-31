self.addEventListener('fetch', (event) => {
  if (event.request.url.startsWith('/scramjet/')) {
    const url = event.request.url.replace('/scramjet/', '');
    // Try to fetch through a proxy or direct
    event.respondWith(
      fetch(url, {
        mode: 'cors',
        credentials: 'omit',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      }).catch(() => {
        return fetch(url);
      }).catch(() => {
        return new Response('Proxy error: Unable to fetch resource', { 
          status: 500,
          headers: { 'Content-Type': 'text/plain' }
        });
      })
    );
  }
});

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
