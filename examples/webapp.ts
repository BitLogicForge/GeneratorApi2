import express from 'express';
const app = express();
app.get('/reports/quarterly', (req, res) => {
  const year = Number(req.query.year) || 2026;
  const quarter = Number(req.query.quarter) || 3;
  res.type('html')
    .send(`<!doctype html><html><head><title>Quarterly report</title>
  <style>body{font-family:Arial;color:#0f172a;padding:36px}small{color:#2563eb;letter-spacing:3px}h1{font-size:42px}.card{background:#eff6ff;padding:24px;border-left:5px solid #2563eb}table{width:100%;border-collapse:collapse;margin-top:32px}td,th{text-align:left;padding:16px;border-bottom:1px solid #cbd5e1}@media print{body{padding:0}}</style>
  </head><body><main data-report-ready><small>PERFORMANCE REVIEW</small><h1>Quarter ${quarter}, ${year}</h1><div class="card">A focused quarter of growth and delivery.</div><table><tr><th>Metric</th><th>Result</th></tr><tr><td>Projects delivered</td><td>12</td></tr><tr><td>Customer satisfaction</td><td>96%</td></tr></table></main></body></html>`);
});
app.get('/documents/:id', (req, res) => {
  const id = req.params.id;
  res
    .type('html')
    .send(
      `<!doctype html><html><head><title>Document</title><style>body{font-family:Arial;padding:40px;color:#0f172a}h1{color:#2563eb}</style></head><body><h1>Document ${id}</h1><p>Rendered from the separate webapp host.</p></body></html>`,
    );
});
app.listen(3001, () =>
  console.log('Demo webapp: http://localhost:3001/reports/quarterly'),
);
