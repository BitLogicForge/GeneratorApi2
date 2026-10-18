import express from 'express';
import { z } from 'zod';

import { loadConfig } from '@/config';
import { documentIdSchema } from '@/validation/schema';

import { createCustomerRoute } from './routes/customer.ts';
import { createReportIdsRoute } from './routes/report-ids.ts';
import { createReportSummaryRoute } from './routes/report-summary.ts';
import { createTmaRoute } from './routes/tma.ts';

const app = express();
app.use('/api', createReportIdsRoute());
app.use('/api', createCustomerRoute());
app.use('/api', createReportSummaryRoute());
app.use('/api', createTmaRoute());
const querySchema = z
  .object({
    language: z.string().default('en'),
    year: z.coerce.number().int().min(2000).max(2100).default(2026),
  })
  .strict();
app.get('/api/reports/:id', (req, res) => {
  const id = documentIdSchema.safeParse(req.params.id);
  const query = querySchema.safeParse(req.query);
  if (!id.success || !query.success) {
    res.status(400).json({ error: 'Invalid report parameters' });
    return;
  }
  // Synthetic values for a runnable example; replace with your own database/API.
  res.json({
    id: id.data,
    ...query.data,
    tableData: Array.from({ length: 3 }, (_, row) =>
      Array.from({ length: 4 }, (_, column) => (row + 1) * 10 + column),
    ),
    chartData: Array.from({ length: 20 }, (_, row) =>
      Array.from({ length: 3 }, (_, column) => (row + 1) * 3 + column),
    ),
    categories: Array.from({ length: 20 }, (_, index) => `A${index + 1}`),
  });
});
app.listen(3002, loadConfig().host, () =>
  console.log(
    'Demo data API: http://localhost:3002/api/reports/id2222?language=en&year=2026',
  ),
);
