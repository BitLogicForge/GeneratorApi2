import assert from 'node:assert/strict';
import { test } from 'node:test';

import request from 'supertest';

import { createApp } from '@/app';

test('recognized JSON parser errors return stable client statuses without logging server failures', async () => {
  let calls = 0;
  const logs: unknown[] = [];
  const generate = async () => {
    calls++;
    return Buffer.alloc(0);
  };
  const app = createApp({
    pdf: { generate },
    presentations: { generate },
    logger: {
      error: (entry) => {
        logs.push(entry);
      },
    },
  });
  const requests = [
    {
      call: request(app)
        .post('/api/exports/pdf')
        .set('Content-Type', 'application/json; charset=made-up')
        .send('{"route":"/report"}'),
      status: 415,
      code: 'UNSUPPORTED_CHARSET',
      message: 'Unsupported JSON charset',
    },
    {
      call: request(app)
        .post('/api/exports/pdf')
        .set('Content-Encoding', 'made-up')
        .send({ route: '/report' }),
      status: 415,
      code: 'UNSUPPORTED_CONTENT_ENCODING',
      message: 'Unsupported content encoding',
    },
    {
      call: request(app)
        .post('/api/exports/pdf')
        .set('Content-Type', 'application/json')
        .send('{'),
      status: 400,
      code: 'INVALID_JSON',
      message: 'Invalid JSON body',
    },
    {
      call: request(app)
        .post('/api/exports/pdf')
        .send({ route: '/report', query: { value: 'x'.repeat(100 * 1024) } }),
      status: 413,
      code: 'BODY_TOO_LARGE',
      message: 'Request body is too large',
    },
  ];
  for (const { call, status, code, message } of requests) {
    const response = await call.expect(status);
    assert.deepEqual(response.body, {
      error: { code, message, requestId: response.headers['x-request-id'] },
    });
    assert.ok(response.headers['x-request-id']);
  }
  assert.equal(calls, 0);
  assert.deepEqual(logs, []);
});

test('unexpected error statuses and parser types cannot override the generic server-error contract', async () => {
  const logs: unknown[] = [];
  const app = createApp({
    pdf: {
      generate: async () => {
        throw Object.assign(new Error('Private internal detail'), {
          type: '__proto__',
          status: 415,
        });
      },
    },
    presentations: { generate: async () => Buffer.alloc(0) },
    logger: {
      error: (entry) => {
        logs.push(entry);
      },
    },
  });
  const response = await request(app)
    .post('/api/exports/pdf')
    .send({ route: '/report' })
    .expect(500);
  assert.deepEqual(response.body, {
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Document generation failed',
      requestId: response.headers['x-request-id'],
    },
  });
  assert.equal(logs.length, 1);
});
