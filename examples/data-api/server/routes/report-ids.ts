import { Router } from 'express';

export function createReportIdsRoute() {
  const router = Router();
  router.get('/reports', (req, res) => {
    if (Object.keys(req.query).length) {
      res.status(400).json({ error: 'Invalid report list parameters' });
      return;
    }
    res.json({ ids: ['id2222', 'id3333', 'id4444'] });
  });
  return router;
}
