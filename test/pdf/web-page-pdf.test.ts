import assert from 'node:assert/strict';
import { test } from 'node:test';

import express from 'express';

import { resolvePdfPrintSettings } from '@/config';
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
    assert.equal(pdf.stats.state, 'ready');
    assert.equal(pdf.stats.launches, 1);
    assert.equal(pdf.stats.launchFailures, 0);
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
    assert.equal(pdf.stats.disconnects, 1);
    assert.equal(pdf.stats.state, 'disconnected');
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

test('configured PDF appearance controls images, page size and hidden elements', async () => {
  const webapp = express();
  webapp.get('/print', (req, res) =>
    res.send(`
    <style>@media print { body { background: blue; } }</style>
    <div class="hide-me">Hidden in configured output</div>
    <img id="image"><script>
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 20;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = 'red'; ctx.fillRect(0, 0, 20, 20);
      document.querySelector('img').src = canvas.toDataURL();
    </script>`),
  );
  const server = webapp.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const config = {
    baseUrl: `http://127.0.0.1:${(server.address() as import('node:net').AddressInfo).port}`,
    port: 3000,
    concurrency: 1,
    timeout: 5000,
  };
  const normal = new WebPagePdfService(config);
  const custom = new WebPagePdfService({
    ...config,
    pdfPrint: {
      ...resolvePdfPrintSettings(),
      printImages: false,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      hideSelectors: ['.hide-me'],
      css: 'body { font-size: 18px; }',
    },
  });
  try {
    const input = pdfSchema.parse({
      route: '/print',
      format: 'A5',
      landscape: true,
    });
    const original = (await normal.generate(input)).toString('latin1');
    const configured = (await custom.generate(input)).toString('latin1');
    assert.match(original, /\/Subtype \/Image/);
    assert.doesNotMatch(configured, /\/Subtype \/Image/);
    const box = configured.match(/\/MediaBox\s*\[0 0 ([\d.]+) ([\d.]+)\]/);
    assert.ok(box);
    assert.ok(Number(box[1]) > Number(box[2]), 'landscape page');
    assert.ok(Math.abs(Number(box[1]) - 595) < 2, 'A5 landscape width');
  } finally {
    await Promise.all([normal.close(), custom.close()]);
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
