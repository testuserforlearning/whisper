import express from 'express';
import path from 'path';
import { handleProxyRequest, handleChunkRequest } from './handler';

export function createRouter() {
  const router = express.Router();

  const demoPublic = path.join(__dirname, '..', '..', 'demo', 'public');
  router.use('/', express.static(demoPublic));

  router.get('/proxy', handleProxyRequest);
  
  // Handle chunk requests that come from webpack bundles
  // These are paths like /chunk-123.js, /assets/chunk.js, etc.
  router.get('*', handleChunkRequest);

  return router;
}
