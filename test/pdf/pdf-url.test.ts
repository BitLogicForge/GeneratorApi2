import assert from 'node:assert/strict';
import { test } from 'node:test';

import request from 'supertest';

import { createApp } from '@/app';
import { loadConfig } from '@/config';

import type { PdfInput } from '@/schemas/pdf';

function fixture(pdfRoutePattern?: string, defaultLanguage?: string) {
  const inputs: PdfInput[] = [];
  const app = createApp({
    config: {
      ...loadConfig({}),
      ...(pdfRoutePattern !== undefined && { pdfRoutePattern }),
      ...(defaultLanguage !== undefined && { defaultLanguage }),
    },
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
    .get('/api/exports/pdf/portrait/id2222.pdf?language=en&year=2026')
    .expect(200);
  assert.match(res.headers['content-disposition'], /id2222.pdf/);
  assert.match(res.headers['content-type'], /application\/pdf/);
  assert.equal(res.headers['cache-control'], 'no-store');
  assert.equal(inputs[0].route, '/documents/id2222');
  assert.deepEqual(inputs[0].query, { language: 'en', year: '2026' });
});

test('document URLs use default language unless supplied or configured in the route', async () => {
  const { app, inputs } = fixture(undefined, 'de');
  await request(app).get('/api/exports/pdf/portrait/id2222.pdf').expect(200);
  assert.deepEqual(inputs[0].query, { language: 'de' });
  await request(app)
    .get('/api/exports/pdf/portrait/id2222.pdf?language=en')
    .expect(200);
  assert.deepEqual(inputs[1].query, { language: 'en' });
  const configured = fixture('/documents/{id}?language=fr', 'de');
  await request(configured.app)
    .get('/api/exports/pdf/portrait/id2222.pdf')
    .expect(200);
  assert.deepEqual(configured.inputs[0].query, {});
  assert.equal(configured.inputs[0].route, '/documents/id2222?language=fr');
});

test('other-host route can receive ID as a configured query parameter', async () => {
  const { app, inputs } = fixture('/report?id={id}&print=true');
  await request(app)
    .get('/api/exports/pdf/portrait/id2222.pdf?language=en')
    .expect(200);
  assert.equal(inputs[0].route, '/report?id=id2222&print=true');
  assert.deepEqual(inputs[0].query, { language: 'en' });
  await request(app)
    .get('/api/exports/pdf/portrait/id2222.pdf?id=someone-else')
    .expect(400);
  await request(app)
    .get('/api/exports/pdf/portrait/id2222.pdf?print=false')
    .expect(400);
});

test('unsafe IDs and repeated query values are rejected before rendering', async () => {
  const { app, inputs } = fixture();
  await request(app).get('/api/exports/pdf/portrait/bad%2Fid.pdf').expect(400);
  await request(app).get('/api/exports/pdf/portrait/bad%5Cid.pdf').expect(400);
  await request(app)
    .get('/api/exports/pdf/portrait/id2222.pdf?language=en&language=fr')
    .expect(400);
  assert.equal(inputs.length, 0);
});

test('configuration validates relative PDF route patterns', () => {
  const config = loadConfig({
    WEBAPP_BASE_URL: 'https://other-host.example',
  });
  assert.equal(config.baseUrl, 'https://other-host.example');
  assert.equal(config.pdfRoutePattern, '/documents/{id}');
  assert.equal(config.defaultLanguage, 'en');
  for (const pattern of [
    'https://example.com/{id}',
    '//example.com/{id}',
    '/document',
    '/\\example.com/{id}',
  ]) {
    assert.throws(() => fixture(pattern));
  }
});

test('document settings come from code rather than environment overrides', () => {
  const config = loadConfig({
    DEFAULT_LANGUAGE: 'de',
    PDF_ROUTE_PATTERN: '/ignored/{id}',
  });
  assert.equal(config.defaultLanguage, 'en');
  assert.equal(config.pdfRoutePattern, '/documents/{id}');
});

test('landscape document URL forces landscape and preserves document validation', async () => {
  const { app, inputs } = fixture();
  const portrait = await request(app)
    .get('/api/exports/pdf/portrait/id2222.pdf')
    .expect(200);
  const landscape = await request(app)
    .get('/api/exports/pdf/landscape/id2222.pdf?language=de&landscape=false')
    .expect(200);
  assert.equal(inputs[0].landscape, false);
  assert.equal(inputs[1].landscape, true);
  assert.equal(inputs[1].route, inputs[0].route);
  assert.deepEqual(inputs[1].query, { language: 'de', landscape: 'false' });
  for (const response of [portrait, landscape]) {
    assert.match(response.headers['content-type'], /application\/pdf/);
    assert.match(response.headers['content-disposition'], /id2222.pdf/);
    assert.equal(response.headers['cache-control'], 'no-store');
    assert.ok(response.headers['x-request-id']);
  }
  await request(app).get('/api/exports/pdf/landscape/bad%2Fid.pdf').expect(400);
  await request(app)
    .get('/api/exports/pdf/landscape/id2222.pdf?language=en&language=de')
    .expect(400);
  const reserved = fixture('/documents/{id}?print=true');
  await request(reserved.app)
    .get('/api/exports/pdf/landscape/id2222.pdf?print=false')
    .expect(400);
  assert.equal(inputs.length, 2);
  assert.equal(reserved.inputs.length, 0);
});

test('PDF document downloads use only the exports namespace', async () => {
  const { app, inputs } = fixture();
  await request(app).get('/id2222.pdf').expect(404);
  await request(app).get('/landscape/id2222.pdf').expect(404);
  await request(app)
    .get('/api/exports/pdf/portrait/id2222.pdf?landscape=true')
    .expect(200);
  assert.equal(inputs.length, 1);
  assert.equal(inputs[0].landscape, false);
});

test('quarterly portrait route forwards validated direct GET parameters to a fixed page', async () => {
  const { app, inputs } = fixture();
  const response = await request(app)
    .get('/api/exports/pdf/portrait/quarterly?year=2027&quarter=2&language=pl')
    .expect(200);
  assert.equal(inputs[0].route, '/reports/quarterly');
  assert.deepEqual(inputs[0].query, {
    year: '2027',
    quarter: '2',
    language: 'pl',
  });
  assert.equal(inputs[0].landscape, false);
  assert.equal(inputs[0].waitForSelector, '[data-report-ready]');
  assert.match(response.headers['content-type'], /application\/pdf/);
  assert.match(
    response.headers['content-disposition'],
    /quarterly-2027-q2-pl.pdf/,
  );
  assert.equal(response.headers['cache-control'], 'no-store');
  assert.ok(response.headers['x-request-id']);
  await request(app).get('/api/exports/pdf/portrait/quarterly').expect(200);
  assert.deepEqual(inputs[1].query, {
    year: '2026',
    quarter: '3',
    language: 'en',
  });
  for (const query of [
    'year=1999',
    'year=2101',
    'year=abc',
    'quarter=5',
    'language=fr',
    'year=2026&year=2027',
    'route=/other',
    'landscape=true',
  ]) {
    await request(app)
      .get(`/api/exports/pdf/portrait/quarterly?${query}`)
      .expect(400);
  }
  assert.equal(inputs.length, 2);
});
