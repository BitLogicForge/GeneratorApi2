import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { test } from 'node:test';

import { Router } from 'express';
import request from 'supertest';
import { z } from 'zod';

import { createApp } from '@/app';
import { loadConfig } from '@/config';
import { AppError } from '@/errors';
import { definePdfReport } from '@/reports/pdf';
import { pdfRenderSchema } from '@/services/pdf/schema';
import { WebPagePdfService } from '@/services/pdf/web-page-pdf';

import type { PdfRenderInput } from '@/services/pdf/schema';

async function fixture() {
  let completedAt = 0;
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const server = createServer((req, res) => {
    if (req.url === '/data') {
      const timer = setTimeout(() => {
        timers.delete(timer);
        completedAt = performance.now();
        res.end('Final report data');
      }, 700);
      timers.add(timer);
    } else if (req.url === '/pending') {
      // Keep this fetch active until timeout closes the browser context.
    } else {
      res.setHeader('Content-Type', 'text/html');
      res.end(`<html><body><div id="ready" hidden>Report</div><script>
        setTimeout(() => document.querySelector('#ready').hidden = false, 1100);
        fetch('${req.url === '/never-idle' ? '/pending' : '/data'}')
          .then(response => response.text()).then(text => document.body.append(text));
      </script></body></html>`);
    }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const origin = `http://127.0.0.1:${address.port}`;
  return {
    origin,
    completedAt: () => completedAt,
    close: async () => {
      for (const timer of timers) clearTimeout(timer);
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    },
  };
}

test('PDF rendering waits for the readiness selector and for pending network requests to settle', async () => {
  const page = await fixture();
  const service = new WebPagePdfService({ ...loadConfig({}), timeout: 5000 });
  try {
    const start = performance.now();
    const pdf = await service.generate(
      pdfRenderSchema.parse({
        route: '/',
        waitForSelector: '#ready',
        waitForNetworkIdle: true,
      }),
      page.origin,
    );
    assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
    assert.ok(
      page.completedAt() > start,
      'Report data must finish loading before printing',
    );
    assert.ok(
      performance.now() - page.completedAt() >= 450,
      'Network must remain idle before printing',
    );
    assert.ok(
      performance.now() - start >= 1100,
      'The visible readiness marker must also be awaited',
    );
  } finally {
    await service.close();
    await page.close();
  }
});

test('network-idle timeout reports RENDER_TIMEOUT and releases the renderer slot', async () => {
  const page = await fixture();
  const service = new WebPagePdfService({
    ...loadConfig({}),
    timeout: 900,
    concurrency: 1,
  });
  try {
    await assert.rejects(
      service.generate(
        pdfRenderSchema.parse({
          route: '/never-idle',
          waitForNetworkIdle: true,
        }),
        page.origin,
      ),
      (error: unknown) =>
        error instanceof AppError &&
        error.status === 504 &&
        error.code === 'RENDER_TIMEOUT',
    );
    assert.equal(service.stats.active, 0);
    const pdf = await service.generate(
      pdfRenderSchema.parse({ route: '/', waitForNetworkIdle: false }),
      page.origin,
    );
    assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
    assert.equal(service.stats.active, 0);
  } finally {
    await service.close();
    await page.close();
  }
});

test('route definitions forward both readiness options while HEAD skips rendering', async () => {
  const inputs: PdfRenderInput[] = [];
  const factory = definePdfReport({
    schema: z.object({}).strict(),
    prepareInput: () => ({
      route: '/',
      waitForSelector: '#ready',
      waitForNetworkIdle: true,
    }),
  });
  const app = createApp(
    {
      pdf: {
        generate: async (input) => {
          inputs.push(input);
          return Buffer.from('%PDF-test');
        },
      },
      logger: { error() {} },
    },
    (dependencies) => Router().get('/report', factory(dependencies)),
  );
  await request(app).get('/report').expect(200);
  assert.equal(inputs[0]?.waitForNetworkIdle, true);
  assert.equal(inputs[0]?.waitForSelector, '#ready');
  await request(app).head('/report').expect(200);
  await request(app).get('/report?waitForNetworkIdle=true').expect(400);
  assert.equal(inputs.length, 1);
});
