import assert from 'node:assert/strict';
import { test } from 'node:test';

import request from 'supertest';

import { createApp } from '@/app';
import { RendererState, TemplateState } from '@/observability/constants';
import { createGenerationQueues } from '@/queue/generation-queue';

test('completion metrics count output and failures without sensitive input', async () => {
  const events: unknown[] = [];
  let fail = false;
  const app = createApp({
    pdf: {
      generate: async () => {
        if (fail)
          throw new Error(
            'private-token report-text https://host/?secret=value',
          );
        return Buffer.from('%PDF-test');
      },
    },
    presentations: { generate: async () => Buffer.alloc(0) },
    logger: {
      info: (event) => events.push(event),
      error: (event) => events.push(event),
    },
  });
  await request(app)
    .get('/api/exports/pdf')
    .query({
      route: '/private-report',
      query: JSON.stringify({ token: 'private-token' }),
    })
    .expect(200);
  fail = true;
  await request(app)
    .post('/api/exports/pdf')
    .send({ route: '/private-report' })
    .expect(500);
  await request(app).get('/api/exports/pdf').expect(400);
  const metrics = await request(app).get('/internal/metrics').expect(200);
  assert.equal(metrics.headers['cache-control'], 'no-store');
  assert.equal(metrics.body.queues.pdf.concurrency, 2);
  const successful = metrics.body.requests.find(
    (entry: { status: number; route: string }) =>
      entry.status === 200 && entry.route === '/api/exports/pdf',
  );
  assert.equal(successful.requests, 1);
  assert.equal(successful.outputBytes, 9);
  assert.ok(successful.queueWaitMs >= 0);
  assert.ok(successful.generationMs >= 0);
  assert.equal(
    metrics.body.requests.filter(
      (entry: { failures: number }) => entry.failures === 1,
    ).length,
    2,
  );
  assert.doesNotMatch(
    JSON.stringify([events, metrics.body]),
    /private-token|private-report|report-text|secret=value/,
  );
  assert.equal(
    events.filter(
      (event) => (event as { event: string }).event === 'request_completed',
    ).length,
    4,
  );
});

test('readiness reflects initialization and shutdown without generating documents', async () => {
  const queues = createGenerationQueues();
  let ready = false;
  const app = createApp({
    queues,
    pdf: {
      generate: async () => {
        throw new Error('probe rendered');
      },
    },
    presentations: {
      generate: async () => {
        throw new Error('probe generated');
      },
    },
    readiness: () => ({
      ready,
      shuttingDown: false,
      templates: ready ? TemplateState.Ready : TemplateState.Validating,
      renderer: ready ? RendererState.Ready : RendererState.Starting,
    }),
    logger: { error() {} },
  });
  await request(app).get('/health').expect(200, { status: 'ok' });
  await request(app).get('/internal/ready').expect(503);
  ready = true;
  await request(app).get('/internal/ready').expect(200);
  await request(app).head('/internal/ready').expect(200);
  queues.pdf.close();
  await request(app).get('/internal/ready').expect(503);
  await request(app).get('/health').expect(200);
});

test('document PDF routes record usage, bytes and failures centrally, including HEAD', async () => {
  const events: Array<Record<string, unknown>> = [];
  let calls = 0;
  const app = createApp({
    pdf: {
      generate: async () => {
        calls++;
        return Buffer.from('%PDF-test');
      },
    },
    presentations: { generate: async () => Buffer.alloc(0) },
    logger: {
      info: (event) => events.push(event as Record<string, unknown>),
      error() {},
    },
  });
  for (const prefix of [
    '/api/exports/pdf/portrait',
    '/api/exports/pdf/landscape',
  ]) {
    await request(app)
      .get(`${prefix}/private-id.pdf?token=private-token`)
      .expect(200);
    await request(app).get(`${prefix}/bad%2Fid.pdf`).expect(400);
    await request(app).head(`${prefix}/private-id.pdf`).expect(200);
  }
  const metrics = await request(app).get('/internal/metrics').expect(200);
  for (const route of [
    '/api/exports/pdf/portrait/:id.pdf',
    '/api/exports/pdf/landscape/:id.pdf',
  ]) {
    const entries = metrics.body.requests.filter(
      (entry: { route: string }) => entry.route === route,
    );
    assert.equal(entries.length, 3);
    const success = entries.find(
      (entry: { method: string; status: number }) =>
        entry.method === 'GET' && entry.status === 200,
    );
    assert.equal(success.requests, 1);
    assert.equal(success.outputBytes, 9);
    assert.ok(success.queueWaitMs >= 0);
    assert.ok(success.generationMs >= 0);
    const failure = entries.find(
      (entry: { status: number }) => entry.status === 400,
    );
    assert.equal(failure.requests, 1);
    assert.equal(failure.failures, 1);
    const head = entries.find(
      (entry: { method: string }) => entry.method === 'HEAD',
    );
    assert.equal(head.requests, 1);
    assert.equal(head.outputBytes, 0);
    assert.equal(head.generationMs, 0);
    assert.ok(
      events.some((event) => event.route === route && event.format === 'pdf'),
    );
  }
  assert.equal(calls, 2);
  assert.doesNotMatch(
    JSON.stringify([events, metrics.body]),
    /private-id|private-token/,
  );
});
