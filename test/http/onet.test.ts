import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { test } from 'node:test';

import request from 'supertest';

import { createApp } from '@/app';
import { loadConfig } from '@/config';
import { AppError } from '@/errors';
import onetFactory from '@/routes/pdf/onet/report';
import { pdfOriginSchema, pdfRenderSchema } from '@/services/pdf/contracts';
import { WebPagePdfService } from '@/services/pdf/web-page-pdf';

import type { PdfRenderInput } from '@/services/pdf/contracts';

const route = {
  method: 'get' as const,
  path: '/pdf/onet',
  file: 'pdf/onet/get.ts',
  factory: onetFactory,
};

test('External page test uses its fixed origin and forwards no caller parameters', async () => {
  const calls: { input: PdfRenderInput; origin?: string }[] = [];
  const app = createApp(
    {
      pdf: {
        generate: async (input, origin) => {
          calls.push({ input, origin });
          return Buffer.from('%PDF-test');
        },
      },
      logger: { error() {} },
    },
    [route],
  );
  const response = await request(app).get('/pdf/onet').expect(200);
  assert.match(response.headers['content-disposition'], /onet\.pdf/);
  assert.equal(calls[0]?.origin, 'https://example.com');
  assert.equal(calls[0]?.input.route, '/');
  assert.deepEqual(calls[0]?.input.query, {});
  assert.equal(calls[0]?.input.landscape, false);
  assert.equal(calls[0]?.input.waitForSelector, undefined);
  await request(app).head('/pdf/onet').expect(200);
  for (const query of [
    'route=/other',
    'externalOrigin=https://other.example',
    'year=2027',
    'language=en',
  ]) {
    await request(app).get(`/pdf/onet?${query}`).expect(400);
  }
  assert.equal(calls.length, 1);
});

test('report origins reject credentials and non-origin URLs', () => {
  assert.equal(
    pdfOriginSchema.parse('https://example.com/'),
    'https://example.com',
  );
  for (const value of [
    'file:///tmp/page.html',
    'https://user:pass@example.com',
    'https://example.com/page',
    'https://example.com/?q=1',
    'https://example.com/#fragment',
  ])
    assert.equal(pdfOriginSchema.safeParse(value).success, false);
});

test('renderer supports a trusted report origin while blocking navigation beyond it', async () => {
  const server = createServer((req, res) => {
    if (req.url === '/redirect') {
      res.writeHead(302, { Location: 'https://example.com/' }).end();
    } else {
      res.setHeader('Content-Type', 'text/html');
      res.end('<html><body>External report</body></html>');
    }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const origin = `http://127.0.0.1:${address.port}`;
  const service = new WebPagePdfService(loadConfig({}));
  try {
    const pdf = await service.generate(
      pdfRenderSchema.parse({ route: '/' }),
      origin,
    );
    assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
    await assert.rejects(
      service.generate(pdfRenderSchema.parse({ route: '/redirect' }), origin),
      (error: unknown) =>
        error instanceof AppError && error.code === 'NAVIGATION_BLOCKED',
    );
  } finally {
    await service.close();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
