import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { WebPagePdfService } from '@/services/web-page-pdf';
import { pdfSchema } from '@/schemas';
test('real Chromium PDF, query parameters, upstream errors and readiness timeout', async () => {
  const webapp = express();
  let query: Record<string, unknown> = {};
  webapp.get('/report', (req, res) => {
    query = req.query;
    res.send('<h1 data-ready>Report</h1>');
  });
  const server = webapp.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const pdf = new WebPagePdfService({
    baseUrl: `http://127.0.0.1:${(server.address() as import('node:net').AddressInfo).port}`,
    port: 3000,
    concurrency: 1,
    timeout: 1000,
  });
  try {
    const bytes = await pdf.generate(
      pdfSchema.parse({
        route: '/report',
        query: { year: 2026 },
        waitForSelector: '[data-ready]',
      }),
    );
    assert.equal(bytes.subarray(0, 5).toString(), '%PDF-');
    assert.equal(query.year, '2026');
    await assert.rejects(pdf.generate(pdfSchema.parse({ route: '/missing' })), {
      code: 'UPSTREAM_ERROR',
    });
    await assert.rejects(
      pdf.generate(
        pdfSchema.parse({ route: '/report', waitForSelector: '#missing' }),
      ),
      { code: 'RENDER_TIMEOUT' },
    );
    const pending = pdf.generate(
      pdfSchema.parse({ route: '/report', waitForSelector: '#missing' }),
    );
    await assert.rejects(pdf.generate(pdfSchema.parse({ route: '/report' })), {
      code: 'RENDER_BUSY',
    });
    await assert.rejects(pending, { code: 'RENDER_TIMEOUT' });
  } finally {
    await pdf.close();
    await new Promise((resolve) => server.close(resolve));
  }
});
