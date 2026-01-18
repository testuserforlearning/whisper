# Whisper — Programmable Web Rewriting Proxy (Demo)

This repository is a minimal, modular scaffold of a programmable web-rewriting proxy named **Whisper** and a demo UI.

Goals:
- Demonstrate a transport wrapper around `bare-mux` (with fallback)
- Proxy requests at `/proxy?url=BASE64(...)`
- Rewrite HTML resources (links, images, scripts, forms) to route through the proxy
- Inject a small client runtime into proxied HTML to route fetch/XHR/WebSocket
- Provide a demo UI that lets a user enter a URL and open it through the proxy

TODOs (high level): advanced rewriting, CSP handling, streaming responses, full WebSocket proxying.

See package.json for scripts. Start with `npm install` then `npm run dev`.
