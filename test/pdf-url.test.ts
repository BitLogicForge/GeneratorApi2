import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import type { PdfInput } from '../src/schemas.js';

function fixture(pdfRoutePattern?: string, defaultLanguage?: string) {
  const inputs: PdfInput[] = [];
  const app = createApp({
    pdfRoutePattern,
    defaultLanguage,
    pdf: {
      generate: async (input) => {
        inputs.push(input);
        return Buffer.from('%PDF-1.7');
      },
    },
    presentations: { generate: async () => Buffer.alloc(0) },
  });
  return { app, inputs };
}

test('filename-style PDF URL maps document ID and forwards query parameters', async () => {
  const { app, inputs } = fixture();
  const res = await request(app)
    .get('/id2222.pdf?language=en&year=2026')
    .expect(200);
  assert.match(res.headers['content-disposition'], /id2222.pdf/);
  assert.match(res.headers['content-type'], /application\/pdf/);
  assert.equal(res.headers['cache-control'], 'no-store');
  assert.equal(inputs[0].route, '/documents/id2222');
  assert.deepEqual(inputs[0].query, { language: 'en', year: '2026' });
});

test('document URLs use default language unless supplied or configured in the route', async () => {
  const { app, inputs } = fixture(undefined, 'de');
  await request(app).get('/id2222.pdf').expect(200);
  assert.deepEqual(inputs[0].query, { language: 'de' });
  await request(app).get('/id2222.pdf?language=en').expect(200);
  assert.deepEqual(inputs[1].query, { language: 'en' });
  const configured = fixture('/documents/{id}?language=fr', 'de');
  await request(configured.app).get('/id2222.pdf').expect(200);
  assert.deepEqual(configured.inputs[0].query, {});
  assert.equal(configured.inputs[0].route, '/documents/id2222?language=fr');
});

test('other-host route can receive ID as a configured query parameter', async () => {
  const { app, inputs } = fixture('/report?id={id}&print=true');
  await request(app).get('/id2222.pdf?language=en').expect(200);
  assert.equal(inputs[0].route, '/report?id=id2222&print=true');
  assert.deepEqual(inputs[0].query, { language: 'en' });
  await request(app).get('/id2222.pdf?id=someone-else').expect(400);
  await request(app).get('/id2222.pdf?print=false').expect(400);
});

test('unsafe IDs and repeated query values are rejected before rendering', async () => {
  const { app, inputs } = fixture();
  await request(app).get('/bad%2Fid.pdf').expect(400);
  await request(app).get('/bad%5Cid.pdf').expect(400);
  await request(app).get('/id2222.pdf?language=en&language=fr').expect(400);
  assert.equal(inputs.length, 0);
});

test('configuration validates relative PDF route patterns', () => {
  const config = loadConfig({
    WEBAPP_BASE_URL: 'https://other-host.example',
    PDF_ROUTE_PATTERN: '/document?id={id}',
  });
  assert.equal(config.baseUrl, 'https://other-host.example');
  assert.equal(config.pdfRoutePattern, '/document?id={id}');
  for (const pattern of [
    'https://example.com/{id}',
    '//example.com/{id}',
    '/document',
    '/\\example.com/{id}',
  ]) {
    assert.throws(() => loadConfig({ PDF_ROUTE_PATTERN: pattern }));
  }
});
