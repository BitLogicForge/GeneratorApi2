import assert from 'node:assert/strict';
import { test } from 'node:test';

import request from 'supertest';

import { createApp } from '@/app';
import { createGenerationQueues } from '@/queue/generation-queue';

test('HEAD export metadata validates query inputs without entering queues or generating files', async () => {
  let calls = 0;
  const generate = async () => {
    calls++;
    throw new Error('HEAD must not generate');
  };
  const queues = createGenerationQueues();
  queues.pdf.close();
  queues.presentations.close();
  const app = createApp({
    pdf: { generate },
    presentations: { generate },
    templatePresentations: { generate },
    templateReportDemo: { generate },
    queues,
  });
  const routes = [
    {
      path: '/api/exports/pdf/portrait/quarterly',
      query: { year: '2027', quarter: '2', language: 'pl' },
      filename: 'quarterly-2027-q2-pl.pdf',
    },
    {
      path: '/api/exports/pdf/portrait/id2222.pdf',
      query: { language: 'de' },
      filename: 'id2222.pdf',
    },
    {
      path: '/api/exports/pdf/landscape/id2222.pdf',
      query: { language: 'de' },
      filename: 'id2222.pdf',
    },
    {
      path: '/api/exports/pdf',
      query: {
        route: '/report',
        landscape: 'true',
        query: JSON.stringify({ year: 2026 }),
        filename: 'report',
      },
      filename: 'report.pdf',
    },
    {
      path: '/api/exports/pptx/pptxgenjs/brief',
      query: {
        title: 'Brief',
        slides: JSON.stringify([{ title: 'Slide', bullets: ['Bullet'] }]),
      },
      filename: 'presentation.pptx',
    },
    {
      path: '/api/exports/pptx/jszip/business',
      query: { replacements: JSON.stringify({ title: 'Report' }) },
      filename: 'presentation.pptx',
    },
    {
      path: '/api/exports/pptx/jszip/summary',
      query: { replacements: JSON.stringify({ title: 'Report' }) },
      filename: 'presentation.pptx',
    },
    {
      path: '/api/exports/pptx/jszip/daa',
      query: { TEXT_ME: 'Report' },
      filename: 'demo-report.pptx',
    },
  ];
  for (const route of routes) {
    const response = await request(app)
      .head(route.path)
      .query(route.query)
      .expect(200);
    assert.equal(response.text, undefined);
    assert.equal(response.headers['cache-control'], 'no-store');
    assert.match(response.headers['content-disposition'], /^attachment;/);
    assert.ok(response.headers['content-disposition'].includes(route.filename));
    assert.match(
      response.headers['content-type'],
      route.filename.endsWith('.pdf') ? /application\/pdf/ : /presentationml/,
    );
    assert.equal(response.headers['content-length'], undefined);
    assert.equal(response.headers['transfer-encoding'], undefined);
    assert.ok(response.headers['x-request-id']);
  }
  for (const path of [
    '/api/exports/pdf/portrait/bad%2Fid.pdf',
    '/api/exports/pdf/portrait/id2222.pdf?language=en&language=de',
    '/api/exports/pdf?route=/report&landscape=wrong',
    '/api/exports/pdf?route=/report&unknown=1',
    '/api/exports/pdf?route=/report&query=wrong',
    '/api/exports/pptx/pptxgenjs/brief?title=Brief&slides=[]',
    '/api/exports/pptx/jszip/summary?replacements=%7B',
    '/api/exports/pptx/jszip/daa?unknown=1',
  ])
    await request(app).head(path).expect(400);
  await request(app).head('/api/exports/pptx/jszip/unknown').expect(404);
  assert.equal(calls, 0);
  assert.equal(queues.pdf.stats.active, 0);
  assert.equal(queues.presentations.stats.active, 0);
});

test('HEAD preserves unavailable-service errors and ordinary GET downloads still generate', async () => {
  let calls = 0;
  const generate = async () => {
    calls++;
    return Buffer.from('%PDF-1.7');
  };
  const app = createApp({ pdf: { generate }, presentations: { generate } });
  await request(app)
    .head('/api/exports/pptx/jszip/summary')
    .query({ replacements: JSON.stringify({ title: 'Report' }) })
    .expect(404);
  await request(app).head('/api/exports/pptx/jszip/daa').expect(404);
  await request(app)
    .get('/api/exports/pdf')
    .query({ route: '/report' })
    .expect(200);
  assert.equal(calls, 1);
});
