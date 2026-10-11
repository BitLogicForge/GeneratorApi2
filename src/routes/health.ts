import { Router } from 'express';

export function createHealthRoute() {
  const router = Router();
  router.get('/health', (req, res) => res.json({ status: 'ok' }));
  return router;
}
