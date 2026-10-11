import { Router } from 'express';
import { z } from 'zod';
import { documentIdSchema } from '../../../../src/pdf-route.js';

const querySchema = z
  .object({
    language: z.string().default('en'),
    year: z.coerce.number().int().min(2000).max(2100).default(2026),
  })
  .strict();

export function createReportSummaryRoute() {
  const router = Router();
  router.get('/reports/:id/summary', (req, res) => {
    const id = documentIdSchema.safeParse(req.params.id);
    const query = querySchema.safeParse(req.query);
    if (!id.success || !query.success) {
      res.status(400).json({ error: 'Invalid report summary parameters' });
      return;
    }
    res.json({
      id: id.data,
      customerId: 'customer100',
      ...query.data,
      totalRevenue: 1250000,
      growthPercent: 12.5,
    });
  });
  return router;
}
