import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';

import request from 'supertest';
import { z } from 'zod';

import { createApp } from '@/app';
import { discoverRoutes } from '@/http/file-routes/discover';
import { definePdfReport } from '@/reports/pdf';
import { definePptxReport } from '@/reports/pptx';
import { createReportServices } from '@/reports/services';
import { report as business } from '@/routes/api/exports/pptx/jszip/business/report';
import { report as daa } from '@/routes/api/exports/pptx/jszip/daa/report';
import { report as summary } from '@/routes/api/exports/pptx/jszip/summary/report';
import { report as brief } from '@/routes/api/exports/pptx/pptxgenjs/brief/report';

import type { PdfRenderInput } from '@/services/pdf/contracts';

for (const extension of ['.ts', '.js']) {
  test(`a discovered ${extension} report owns its service across GET, POST, readiness, and shutdown`, async (t) => {
    const folder = await mkdtemp(join(tmpdir(), 'generator-report-'));
    t.after(() => rm(folder, { recursive: true, force: true }));
    await mkdir(join(folder, 'sales'));
    await writeFile(join(folder, 'package.json'), '{"type":"module"}');
    const definition = join(folder, `sales/report${extension}`);
    await writeFile(
      definition,
      `
import { z } from ${JSON.stringify(new URL('../../node_modules/zod/index.js', import.meta.url).href)};
import { definePptxReport } from ${JSON.stringify(new URL('../../src/reports/pptx.ts', import.meta.url).href)};
export const state = { created: 0, validated: 0, closed: 0, generated: 0 };
export default definePptxReport({
  schema: z.object({ title: z.string().min(1).default('Sales') }).strict(),
  filename: 'sales',
  createService: ({ config }) => {
    state.created++;
    return {
      validate: async () => { state.validated++; },
      close: async () => { state.closed++; },
      generate: async (input) => {
        state.generated++;
        return Buffer.from(input.title + ':' + config.baseUrl);
      },
    };
  },
});
`,
    );
    for (const method of ['get', 'post'])
      await writeFile(
        join(folder, `sales/${method}${extension}`),
        `export { default } from './report${extension}';`,
      );
    const routes = await discoverRoutes(pathToFileURL(`${folder}/`), extension);
    const module: { state: Record<string, number> } = await import(
      pathToFileURL(definition).href
    );
    const reports = createReportServices();
    t.after(() => reports.close());
    const app = createApp(
      { pdf: { generate: async () => Buffer.alloc(0) }, reports },
      routes,
    );
    assert.equal(module.state.created, 1);
    await Promise.all([reports.initialize(), reports.initialize()]);
    const get = await request(app)
      .get('/sales?title=Quarterly')
      .buffer(true)
      .parse((res, done) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => done(null, Buffer.concat(chunks)));
      })
      .expect(200);
    assert.match(get.headers['content-disposition'], /sales\.pptx/);
    assert.equal(get.body.toString(), 'Quarterly:http://localhost:3001');
    await request(app).post('/sales').send({ title: 'Annual' }).expect(200);
    await request(app).get('/sales?unknown=1').expect(400);
    await request(app).get('/sales?title=A&title=B').expect(400);
    await request(app).head('/sales').expect(200);
    await Promise.all([reports.close(), reports.close()]);
    assert.deepEqual(module.state, {
      created: 1,
      validated: 1,
      closed: 1,
      generated: 2,
    });
  });
}

test('existing reports support generic overrides without adding dependency properties', async () => {
  const reports = createReportServices();
  let calls = 0;
  const generate = async () => {
    calls++;
    return Buffer.from('injected');
  };
  reports
    .override(business, { generate })
    .override(summary, { generate })
    .override(daa, { generate })
    .override(brief, { generate });
  const app = createApp({ reports, pdf: { generate } });
  await request(app).get('/internal/ready').expect(503);
  await reports.initialize();
  await request(app).get('/internal/ready').expect(200);
  await request(app)
    .post('/api/exports/pptx/jszip/business')
    .send({ replacements: { title: 'B' } })
    .expect(200);
  await request(app)
    .post('/api/exports/pptx/jszip/summary')
    .send({ replacements: { title: 'S' } })
    .expect(200);
  await request(app).get('/api/exports/pptx/jszip/daa').expect(200);
  await request(app)
    .post('/api/exports/pptx/pptxgenjs/brief')
    .send({ title: 'Brief', slides: [{ title: 'One', bullets: ['A'] }] })
    .expect(200);
  assert.equal(calls, 4);
  await reports.close();
});

test('failed report validation keeps readiness unavailable and closes every owned service', async () => {
  const reports = createReportServices();
  let closed = 0;
  const definition = {
    schema: z.object({}).strict(),
    filename: 'broken',
    createService: () => ({
      generate: async () => Buffer.alloc(0),
      validate: async () => {
        throw new Error('Invalid template');
      },
      close: async () => {
        closed++;
      },
    }),
  };
  const factory = definePptxReport(definition);
  const app = createApp(
    { reports, pdf: { generate: async () => Buffer.alloc(0) } },
    [
      { path: '/broken', method: 'get', file: 'broken/get.ts', factory },
      // Keep the normal readiness route without a special test implementation.
      ...(
        await discoverRoutes(new URL('../../src/routes/', import.meta.url))
      ).filter((route) => route.path === '/internal/ready'),
    ],
  );
  await assert.rejects(reports.initialize(), /Invalid template/);
  await request(app).get('/internal/ready').expect(503);
  await reports.close();
  assert.equal(closed, 1);
});

test('PDF report settings are local, validated, and shared by GET and POST', async () => {
  const inputs: PdfRenderInput[] = [];
  const factory = definePdfReport({
    schema: z
      .object({
        year: z
          .string()
          .regex(/^\d{4}$/)
          .default('2026'),
      })
      .strict(),
    prepareInput: (input) => ({
      route: '/reports/sales',
      query: input,
      filename: `sales-${input.year}`,
    }),
    print: {
      format: 'A5',
      landscape: true,
      margin: { top: 0 },
      printImages: false,
    },
  });
  const app = createApp(
    {
      pdf: {
        generate: async (input) => {
          inputs.push(input);
          return Buffer.from('%PDF-');
        },
      },
    },
    [
      { path: '/sales', method: 'get', file: 'sales/get.ts', factory },
      { path: '/sales', method: 'post', file: 'sales/post.ts', factory },
    ],
  );
  await request(app).get('/sales?year=2027').expect(200);
  await request(app).post('/sales').send({ year: '2028' }).expect(200);
  await request(app).get('/sales?unknown=1').expect(400);
  await request(app).head('/sales').expect(200);
  assert.equal(inputs.length, 2);
  assert.equal(inputs[0]!.format, 'A5');
  assert.equal(inputs[0]!.landscape, true);
  assert.equal(inputs[0]!.filename, 'sales-2027');
  assert.deepEqual(inputs[0]!.print?.margin, { top: 0 });
  const invalid = definePdfReport({
    schema: z.object({}),
    prepareInput: () => ({ route: '/reports/sales' }),
    print: { margin: { top: -1 } },
  });
  assert.throws(() =>
    createApp({ pdf: { generate: async () => Buffer.alloc(0) } }, [
      {
        path: '/invalid',
        method: 'get',
        file: 'invalid/get.ts',
        factory: invalid,
      },
    ]),
  );
});
