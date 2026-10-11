import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type { AddressInfo } from 'node:net';
import request from 'supertest';
import { loadConfig } from '@/config';
import { DataApiClient } from '@/services/data-api-client';
import { createReportIdsRoute } from '@examples/data-api/server/routes/report-ids';
import { fetchReportDataBatch } from '@examples/data-api/batch/collect';

test('demo report-ID endpoint returns IDs and rejects unknown query parameters', async () => {
  const app = express();
  app.use('/api', createReportIdsRoute());
  await request(app)
    .get('/api/reports')
    .expect(200, { ids: ['id2222', 'id3333', 'id4444'] });
  await request(app).get('/api/reports?unknown=true').expect(400);
});

test('batch collects by requested ID or as a list, deduplicates IDs, and rejects invalid data', async (t) => {
  const app = express();
  let ids: unknown[] = ['id2222', 'id3333', 'id2222'];
  let invalidReport = false;
  const calls: string[] = [];
  app.get('/api/reports', (req, res) => res.json({ ids }));
  app.get('/api/reports/:id', (req, res) => {
    calls.push(req.originalUrl);
    if (invalidReport) {
      res.json({ id: req.params.id });
      return;
    }
    res.json({
      id: `returned-${req.params.id}`,
      language: req.query.language,
      year: Number(req.query.year),
      tableData: Array.from({ length: 3 }, () => [1, 2, 3, 4]),
      chartData: Array.from({ length: 20 }, () => [1, 2, 3]),
      categories: Array.from({ length: 20 }, (_, i) => `A${i + 1}`),
    });
  });
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
  const query = { language: 'pl', year: 2025 };
  const byId = await fetchReportDataBatch(api, query);
  const value: number = byId.id2222.tableData[0][0];
  assert.equal(value, 1);
  assert.deepEqual(Object.keys(byId), ['id2222', 'id3333']);
  assert.equal(byId.id2222.id, 'returned-id2222');
  assert.deepEqual(calls, [
    '/api/reports/id2222?language=pl&year=2025',
    '/api/reports/id3333?language=pl&year=2025',
  ]);
  const list = await fetchReportDataBatch(api, query, 'list');
  assert.deepEqual(
    list.map(({ requestedId }) => requestedId),
    ['id2222', 'id3333'],
  );
  assert.deepEqual(list[0].data, byId.id2222);
  ids = [];
  calls.length = 0;
  assert.deepEqual(await fetchReportDataBatch(api, query, 'dict'), {});
  assert.deepEqual(await fetchReportDataBatch(api, query, 'list'), []);
  assert.deepEqual(calls, []);
  ids = [123];
  await assert.rejects(fetchReportDataBatch(api, query), {
    code: 'DATA_API_INVALID_RESPONSE',
  });
  assert.deepEqual(calls, []);
  ids = ['id2222', 'id3333'];
  invalidReport = true;
  await assert.rejects(fetchReportDataBatch(api, query), {
    code: 'DATA_API_INVALID_RESPONSE',
  });
  assert.deepEqual(calls, ['/api/reports/id2222?language=pl&year=2025']);
});
