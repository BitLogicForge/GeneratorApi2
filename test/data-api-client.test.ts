import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { z } from 'zod';
import { loadConfig } from '../src/config.js';
import { DataApiClient } from '../src/services/data-api-client.js';

test('data API config validates URLs and supports an unconfigured API', () => {
  const config = loadConfig({});
  assert.equal(config.dataApi.baseUrl, undefined);
  assert.equal(config.dataApi.timeoutMs, 10000);
  assert.equal(
    loadConfig({ DATA_API_BASE_URL: '', DATA_API_TOKEN: '' }).dataApi.token,
    undefined,
  );
  for (const url of [
    'file:///tmp/data',
    'https://user:password@example.com',
    'https://example.com?token=secret',
    'https://example.com#fragment',
  ])
    assert.throws(() => loadConfig({ DATA_API_BASE_URL: url }));
});

test('data API client encodes parameters, authenticates, validates data, and handles failures', async (t) => {
  const app = express();
  let seen:
    | { path: string; query: unknown; authorization: string | undefined }
    | undefined;
  app.get('/v1/reports/id2222', (req, res) => {
    seen = {
      path: req.path,
      query: { ...req.query },
      authorization: req.headers.authorization,
    };
    res.json({ id: 'id2222', value: 42 });
  });
  app.get('/v1/error', (req, res) =>
    res.status(401).send('private upstream details'),
  );
  app.get('/v1/invalid-json', (req, res) => res.send('<html>not JSON</html>'));
  app.get('/v1/invalid-data', (req, res) =>
    res.json({ value: 'not a number' }),
  );
  app.get('/v1/redirect', (req, res) => res.redirect('/v1/reports/id2222'));
  app.get('/v1/slow', (req, res) => {
    setTimeout(() => {
      if (!res.destroyed) res.json({ id: 'id2222', value: 42 });
    }, 200);
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  t.after(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`;
  const config = loadConfig({
    DATA_API_BASE_URL: baseUrl,
    DATA_API_TOKEN: 'test-token',
    DATA_API_TIMEOUT_MS: '1000',
  });
  const api = new DataApiClient(config.dataApi);
  const schema = z.object({ id: z.string(), value: z.number() });
  const data = await api.get(
    '/reports/id2222',
    {
      language: 'en',
      year: 2026,
      active: true,
      search: 'A & B/Ż',
      omitted: undefined,
    },
    schema,
  );
  assert.deepEqual(data, { id: 'id2222', value: 42 });
  assert.deepEqual(seen, {
    path: '/v1/reports/id2222',
    query: { language: 'en', year: '2026', active: 'true', search: 'A & B/Ż' },
    authorization: 'Bearer test-token',
  });
  for (const path of [
    'https://example.com',
    '//example.com',
    '../outside',
    '/\\example.com',
  ])
    await assert.rejects(api.get(path, {}, schema), {
      code: 'INVALID_DATA_API_PATH',
    });
  await assert.rejects(api.get('/error', {}, schema), {
    code: 'DATA_API_HTTP_ERROR',
    status: 502,
    message: 'Data API returned HTTP 401',
  });
  await assert.rejects(api.get('/redirect', {}, schema), {
    code: 'DATA_API_HTTP_ERROR',
  });
  for (const path of ['/invalid-json', '/invalid-data'])
    await assert.rejects(api.get(path, {}, schema), {
      code: 'DATA_API_INVALID_RESPONSE',
    });
  await assert.rejects(api.get('/reports/id2222', { year: NaN }, schema), {
    code: 'INVALID_DATA_API_QUERY',
  });
  await assert.rejects(
    new DataApiClient(loadConfig({}).dataApi).get(
      '/reports/id2222',
      {},
      schema,
    ),
    { code: 'DATA_API_NOT_CONFIGURED' },
  );
  await assert.rejects(
    new DataApiClient({ ...config.dataApi, timeoutMs: 50 }).get(
      '/slow',
      {},
      schema,
    ),
    { code: 'DATA_API_TIMEOUT', status: 504 },
  );
});
