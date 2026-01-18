import express from 'express';
import http from 'http';
import { createRouter } from './router';
import WebSocket, { Server as WebSocketServer } from 'ws';
import { b64decode } from './utils';

const app = express();
const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;

app.use(createRouter());

const server = http.createServer(app);

const wsServer = new WebSocketServer({ noServer: true });

server.on('upgrade', (req, socket, head) => {
  const pathname = req.url || '/';

  const rawReferer = req.headers.referer ?? req.headers.referrer;
  const referer = Array.isArray(rawReferer) ? rawReferer[0] : rawReferer;
  let targetOrigin: string | null = null;
  try {
    if (referer) {
      const u = new URL(referer);
      const encoded = u.searchParams.get('url');
      if (encoded) targetOrigin = new URL(b64decode(encoded)).origin;
    }
  } catch (e) {
    targetOrigin = null;
  }

  if (!targetOrigin) {
    socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
    socket.destroy();
    return;
  }

  
  try {
    const upstreamProto = targetOrigin.startsWith('https:') ? 'wss:' : 'ws:';
    const upstreamUrl = `${upstreamProto}//${new URL(targetOrigin).host}${pathname}`;

    wsServer.handleUpgrade(req, socket, head, (clientWs: WebSocket) => {
      const upstream = new WebSocket(upstreamUrl);

      clientWs.on('message', (msg: WebSocket.Data) => { if (upstream.readyState === WebSocket.OPEN) upstream.send(msg); });
      upstream.on('message', (msg: WebSocket.Data) => { if (clientWs.readyState === WebSocket.OPEN) clientWs.send(msg); });

      const cleanup = () => { try { upstream.close(); } catch {} };
      clientWs.on('close', cleanup);
      clientWs.on('error', cleanup);
      upstream.on('close', () => { try { clientWs.close(); } catch {} });
      upstream.on('error', () => { try { clientWs.close(); } catch {} });
    });
  } catch (e) {
    socket.write('HTTP/1.1 502 Bad Gateway\r\n\r\n');
    socket.destroy();
    return;
  }
});

server.listen(port, () => {
  console.log(`Whisper proxy demo listening on http://localhost:${port}`);
  console.log(`Open http://localhost:${port}/ to access the demo UI`);
});
