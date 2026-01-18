import express from 'express';
import path from 'path';
import { handleProxyRequest } from './handler';

export function createRouter() {
  const router = express.Router();

  const demoPublic = path.join(__dirname, '..', '..', 'demo', 'public');
  router.use('/', express.static(demoPublic));

  router.get('/proxy', handleProxyRequest);

  return router;
}
