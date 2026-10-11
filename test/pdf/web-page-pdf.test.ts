import assert from 'node:assert/strict';
import { test } from 'node:test';

import express from 'express';

import { pdfSchema } from '@/schemas';
import { WebPagePdfService } from '@/services/pdf/web-page-pdf';

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

test('navigation stays within the configured origin across redirects, frames, and popups', async () => {
  let outsideRequests = 0;
  const outside = express();
  outside.use((req, res) => {
    outsideRequests++;
    res.send('<h1>Outside</h1>');
  });
  const outsideServer = outside.listen(0, '127.0.0.1');
  await new Promise((resolve) => outsideServer.once('listening', resolve));
  const outsideUrl = `http://127.0.0.1:${(outsideServer.address() as import('node:net').AddressInfo).port}/outside`;
  const webapp = express();
  webapp.get('/redirect', (req, res) => res.redirect('/nested/final'));
  webapp.get('/nested/final', (req, res) =>
    res.send('<script src="ready.js"></script><h1>Report</h1>'),
  );
  webapp.get('/nested/ready.js', (req, res) =>
    res.type('js').send('document.documentElement.dataset.ready = "true"'),
  );
  webapp.get('/escape', (req, res) => res.redirect(outsideUrl));
  webapp.get('/chain', (req, res) => res.redirect('/escape'));
  webapp.get('/frame', (req, res) =>
    res.send('<iframe src="/chain"></iframe>'),
  );
  webapp.get('/script', (req, res) =>
    res.send('<script>location.replace("/chain")</script>'),
  );
  webapp.get('/popup', (req, res) =>
    res.send('<script>window.open("/chain")</script>'),
  );
  const server = webapp.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const pdf = new WebPagePdfService({
    baseUrl: `http://127.0.0.1:${(server.address() as import('node:net').AddressInfo).port}`,
    port: 3000,
    concurrency: 1,
    timeout: 3000,
  });
  try {
    const bytes = await pdf.generate(
      pdfSchema.parse({
        route: '/redirect',
        waitForSelector: 'html[data-ready="true"]',
      }),
    );
    assert.equal(bytes.subarray(0, 5).toString(), '%PDF-');
    for (const route of ['/escape', '/chain', '/frame', '/script', '/popup']) {
      await assert.rejects(
        pdf.generate(
          pdfSchema.parse({ route, waitForSelector: '#never-ready' }),
        ),
        { code: 'NAVIGATION_BLOCKED' },
      );
      assert.equal(outsideRequests, 0, route);
    }
    const recovered = await pdf.generate(
      pdfSchema.parse({
        route: '/nested/final',
        waitForSelector: 'html[data-ready="true"]',
      }),
    );
    assert.equal(recovered.subarray(0, 5).toString(), '%PDF-');
  } finally {
    await pdf.close();
    await Promise.all(
      [server, outsideServer].map(
        (instance) =>
          new Promise<void>((resolve) => instance.close(() => resolve())),
      ),
    );
  }
});
