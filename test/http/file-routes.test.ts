import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';

import express from 'express';
import request from 'supertest';

import { discoverRoutes } from '@/http/file-routes/discover';
import { routePath } from '@/http/file-routes/path';
import { registerRoutes } from '@/http/file-routes/register';
import { createGenerationQueues } from '@/queue/generation-queue';

async function fixture(files: Record<string, string>) {
  const folder = await mkdtemp(join(tmpdir(), 'generator-file-routes-'));
  await writeFile(join(folder, 'package.json'), '{"type":"module"}');
  for (const [name, source] of Object.entries(files)) {
    await mkdir(dirname(join(folder, name)), { recursive: true });
    await writeFile(join(folder, name), source);
  }
  return { folder, url: pathToFileURL(`${folder}/`) };
}

const dependencies = {
  pdf: { generate: async () => Buffer.from('injected') },
  presentations: { generate: async () => Buffer.alloc(0) },
  config: { pdfRoutePattern: '/documents/{id}', defaultLanguage: 'en' },
  queues: createGenerationQueues(),
};

for (const extension of ['.ts', '.js']) {
  test(`loads ${extension} route folders, injects services and prioritizes static paths`, async (t) => {
    const handler =
      'export default () => (req, res) => res.json({ id: req.params.id });';
    const { folder, url } = await fixture({
      [`reports/[id]/get${extension}`]: handler,
      [`reports/current/get${extension}`]:
        'export default () => (req, res) => res.json({ current: true });',
      [`reports/[id]/preview/get${extension}`]:
        'export default () => (req, res) => res.json({ preview: true });',
      [`reports/[id]/[view]/get${extension}`]:
        'export default () => (req, res) => res.json({ view: req.params.view });',
      [`[id].pdf/get${extension}`]: handler,
      [`get${extension}`]:
        'export default () => (req, res) => res.json({ root: true });',
      [`reports/[id]/post${extension}`]:
        'export default ({ pdf }) => async (req, res) => res.send(await pdf.generate());',
      [`reports/[id]/handler${extension}`]:
        'throw new Error("Helpers must not be loaded");',
      [`_shared/ignored/get${extension}`]:
        'throw new Error("Private folders must not be loaded");',
      [`ignored/get${extension === '.ts' ? '.js' : '.ts'}`]:
        'throw new Error("Opposite runtime extension must not be loaded");',
    });
    t.after(() => rm(folder, { recursive: true, force: true }));
    const routes = await discoverRoutes(url, extension);
    const app = express();
    registerRoutes(app, routes, dependencies);
    await request(app).get('/').expect(200, { root: true });
    await request(app).get('/reports/current').expect(200, { current: true });
    await request(app).get('/reports/42').expect(200, { id: '42' });
    await request(app)
      .get('/reports/42/preview')
      .expect(200, { preview: true });
    await request(app)
      .get('/reports/42/details')
      .expect(200, { view: 'details' });
    await request(app).get('/42.pdf').expect(200, { id: '42' });
    const response = await request(app).post('/reports/42').expect(200);
    assert.deepEqual(response.body, Buffer.from('injected'));
    await request(app).delete('/reports/42').expect(404);
  });
}

test('explicit HEAD handlers run before implicit GET handling', async (t) => {
  const { folder, url } = await fixture({
    '[id]/get.ts':
      'export default () => (req, res) => res.set("X-Handler", "get").send("get");',
    '[name]/head.ts':
      'export default () => (req, res) => res.set("X-Handler", "head").end();',
  });
  t.after(() => rm(folder, { recursive: true, force: true }));
  const app = express();
  registerRoutes(app, await discoverRoutes(url), dependencies);
  await request(app).head('/42').expect(200).expect('X-Handler', 'head');
  await request(app).get('/42').expect(200).expect('X-Handler', 'get');
});

test('ambiguous duplicate paths fail before importing route modules', async (t) => {
  const cases: Record<string, string>[] = [
    { 'reports/[id]/get.ts': '', 'reports/[name]/get.ts': '' },
    { 'health/get.ts': '', 'Health/get.ts': '' },
  ];
  for (const files of cases) {
    const { folder, url } = await fixture(files);
    t.after(() => rm(folder, { recursive: true, force: true }));
    await assert.rejects(discoverRoutes(url), /Duplicate route/);
  }
});

test('invalid default exports and handler factories fail at startup', async (t) => {
  const invalidExport = await fixture({
    'health/get.ts': 'export default 42;',
  });
  t.after(() => rm(invalidExport.folder, { recursive: true, force: true }));
  await assert.rejects(discoverRoutes(invalidExport.url), /handler factory/);
  const invalidHandler = await fixture({
    'health/get.ts': 'export default () => 42;',
  });
  t.after(() => rm(invalidHandler.folder, { recursive: true, force: true }));
  const routes = await discoverRoutes(invalidHandler.url);
  assert.throws(
    () => registerRoutes(express(), routes, dependencies),
    /return a handler/,
  );
});

test('folder parameters are validated without enabling wildcard or pattern syntax', () => {
  assert.equal(routePath('reports/[id]/get.ts'), '/reports/:id');
  assert.equal(routePath('[id].pdf/get.ts'), '/:id.pdf');
  for (const file of [
    '[id]/[id]/get.ts',
    'reports/[bad-name]/get.ts',
    ':id/get.ts',
    'reports/*/get.ts',
  ])
    assert.throws(() => routePath(file));
});
