import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { z } from 'zod';
import { loadConfig } from '../src/config.ts';
import request from 'supertest';
import { fetchReportDataChain } from '../examples/data-api/chain/collect.ts';
import { createCustomerRoute } from '../examples/data-api/server/routes/customer.ts';
import { createReportSummaryRoute } from '../examples/data-api/server/routes/report-summary.ts';
import { DataApiClient } from '../src/services/data-api-client.ts';

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
  app.get('/v1/slow-body', (req, res) => {
    res.type('json');
    res.write('{"id":"id2222",');
    setTimeout(() => {
      if (!res.destroyed) res.end('"value":42}');
    }, 200);
  });
  const report = {
    id: 'id2222',
    language: 'en',
    year: 2026,
    tableData: Array.from({ length: 3 }, () => [10, 11, 12, 13]),
    chartData: Array.from({ length: 20 }, () => [1, 2, 3]),
    categories: Array.from({ length: 20 }, (_, i) => `A${i + 1}`),
  };
  app.get('/v1/reports/:id', (req, res) =>
    res.json({ ...report, id: req.params.id }),
  );
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
  const reportApi = new DataApiClient(config.dataApi);
  const reportData = await reportApi.get(
    'report',
    { id: 'full /Ż' },
    { language: 'en', year: 2026 },
  );
  const tableValue: number = reportData.tableData[0][0];
  assert.equal(tableValue, 10);
  assert.deepEqual(reportData, { ...report, id: 'full /Ż' });
  await assert.rejects(reportApi.get('report', { id: 'id2222' }), {
    code: 'DATA_API_INVALID_RESPONSE',
  });
  const schema = z.object({ id: z.string(), value: z.number() });
  const clientConfig = {
    ...config.dataApi,
    endpoints: {
      test: { path: ({ path }: { path: string }) => path, response: schema },
    },
  };
  const api = new DataApiClient(clientConfig);
  const data = await api.get(
    'test',
    { path: '/reports/id2222' },
    {
      language: 'en',
      year: 2026,
      active: true,
      search: 'A & B/Ż',
      omitted: undefined,
    },
  );
  const value: number = data.value;
  assert.equal(value, 42);
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
    await assert.rejects(api.get('test', { path }), {
      code: 'INVALID_DATA_API_PATH',
    });
  await assert.rejects(api.get('test', { path: '/error' }), {
    code: 'DATA_API_HTTP_ERROR',
    status: 502,
    message: 'Data API returned HTTP 401',
  });
  await assert.rejects(api.get('test', { path: '/redirect' }), {
    code: 'DATA_API_HTTP_ERROR',
  });
  for (const path of ['/invalid-json', '/invalid-data'])
    await assert.rejects(api.get('test', { path }), {
      code: 'DATA_API_INVALID_RESPONSE',
    });
  await assert.rejects(
    api.get('test', { path: '/reports/id2222' }, { year: NaN }),
    {
      code: 'INVALID_DATA_API_QUERY',
    },
  );
  await assert.rejects(
    new DataApiClient({ ...clientConfig, baseUrl: undefined }).get('test', {
      path: '/reports/id2222',
    }),
    { code: 'DATA_API_NOT_CONFIGURED' },
  );
  await assert.rejects(
    new DataApiClient({ ...clientConfig, timeoutMs: 50 }).get('test', {
      path: '/slow',
    }),
    { code: 'DATA_API_TIMEOUT', status: 504 },
  );
  await assert.rejects(
    new DataApiClient({ ...clientConfig, timeoutMs: 50 }).get('test', {
      path: '/slow-body',
    }),
    { code: 'DATA_API_TIMEOUT', status: 504 },
  );
});

test('configured customer and report summary endpoints fetch typed demo responses', async (t) => {
  const app = express();
  app.use('/api', createCustomerRoute());
  app.use('/api', createReportSummaryRoute());
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  t.after(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });
  const config = loadConfig({
    DATA_API_BASE_URL: `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`,
  });
  const api = new DataApiClient(config.dataApi);
  const customer = await api.get('customer', { id: 'customer100' });
  const email: string = customer.contactEmail;
  assert.equal(email, 'reports@example.com');
  assert.deepEqual(customer, {
    id: 'customer100',
    name: 'Acme',
    industry: 'Manufacturing',
    contactEmail: 'reports@example.com',
  });
  const summary = await api.get(
    'reportSummary',
    { id: 'id2222' },
    { language: 'pl', year: 2025 },
  );
  const revenue: number = summary.totalRevenue;
  assert.equal(revenue, 1250000);
  assert.deepEqual(summary, {
    id: 'id2222',
    customerId: 'customer100',
    language: 'pl',
    year: 2025,
    totalRevenue: 1250000,
    growthPercent: 12.5,
  });
  const defaults = await api.get('reportSummary', { id: 'id2222' });
  assert.equal(defaults.language, 'en');
  assert.equal(defaults.year, 2026);
  await request(app).get('/api/customers/bad%20id').expect(400);
  await request(app).get('/api/customers/customer100?unknown=true').expect(400);
  await request(app)
    .get('/api/reports/id2222/summary?year=invalid')
    .expect(400);
  await request(app)
    .get('/api/reports/id2222/summary?unknown=true')
    .expect(400);
});

test('API chain uses response values and stops when a response is invalid', async (t) => {
  const app = express();
  const calls: string[] = [];
  app.use((req, res, next) => {
    calls.push(req.originalUrl);
    next();
  });
  app.get('/api/reports/:id/summary', (req, res) => {
    if (req.params.id === 'invalid') {
      res.json({ id: 'invalid' });
      return;
    }
    res.json({
      id: 'resolved2222',
      customerId: 'customer200',
      language: 'pl',
      year: 2025,
      totalRevenue: 100,
      growthPercent: 5,
    });
  });
  app.use('/api', createCustomerRoute());
  app.get('/api/reports/:id', (req, res) =>
    res.json({
      id: req.params.id,
      language: req.query.language,
      year: Number(req.query.year),
      tableData: Array.from({ length: 3 }, () => [1, 2, 3, 4]),
      chartData: Array.from({ length: 20 }, () => [1, 2, 3]),
      categories: Array.from({ length: 20 }, (_, i) => `A${i + 1}`),
    }),
  );
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  t.after(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });
  const config = loadConfig({
    DATA_API_BASE_URL: `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`,
  });
  const api = new DataApiClient(config.dataApi);
  const result = await fetchReportDataChain(api, 'requested1111', {
    language: 'en',
    year: 2026,
  });
  assert.deepEqual(calls, [
    '/api/reports/requested1111/summary?language=en&year=2026',
    '/api/customers/customer200',
    '/api/reports/resolved2222?language=pl&year=2025',
  ]);
  assert.equal(result.customer.id, 'customer200');
  assert.equal(result.report.id, 'resolved2222');
  assert.equal(result.report.language, 'pl');
  calls.length = 0;
  await assert.rejects(fetchReportDataChain(api, 'invalid', {}), {
    code: 'DATA_API_INVALID_RESPONSE',
  });
  assert.deepEqual(calls, ['/api/reports/invalid/summary']);
});
