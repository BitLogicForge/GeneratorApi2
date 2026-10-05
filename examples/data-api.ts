import express from 'express';
import { loadConfig } from '../src/config.js';

const app = express();
app.get('/api/reports/:id', (req, res) => {
  // Synthetic values for a runnable example; replace with your own database/API.
  res.json({
    id: req.params.id,
    language: req.query.language ?? 'en',
    year: Number(req.query.year ?? 2026),
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
