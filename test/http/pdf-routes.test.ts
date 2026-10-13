import assert from 'node:assert/strict';
import { test } from 'node:test';

import request from 'supertest';
import { z } from 'zod';

import { createApp } from '@/app';
import { definePdfReport } from '@/reports/pdf';

import type { PdfRenderInput } from '@/services/pdf/contracts';

function setup() {
  const inputs: PdfRenderInput[] = [];
  const app = createApp({
    pdf: {
      generate: async (input) => {
        inputs.push(input);
        return Buffer.from('%PDF-test');
      },
    },
    logger: { error() {} },
  });
  return { app, inputs };
}

for (const [kind, landscape] of [
  ['onepager', true],
  ['factsheet', false],
] as const) {
  test(`${kind} maps its path and allowed query values into the external page`, async () => {
    const { app, inputs } = setup();
    const parameters =
      kind === 'onepager'
        ? {
            START: '2024-02-29',
            END: '2027-12-31',
            BENCHMARK: 'SAA',
          }
        : { language: 'de', year: '2027' };
    const response = await request(app)
      .get(`/pdf/${kind}/id2222`)
      .query(parameters)
      .expect(200);
    assert.match(response.headers['content-type'], /application\/pdf/);
    assert.match(response.headers['content-disposition'], /id2222\.pdf/);
    assert.equal(response.headers['cache-control'], 'no-store');
    assert.ok(response.headers['x-request-id']);
    assert.equal(inputs[0]?.route, `/${kind}/id2222`);
    assert.deepEqual(inputs[0]?.query, parameters);
    assert.equal(inputs[0]?.landscape, landscape);
    assert.equal(inputs[0]?.print?.landscape, landscape);
  });

  test(`${kind} handles omitted parameters and validates HEAD without rendering`, async () => {
    const { app, inputs } = setup();
    await request(app).get(`/pdf/${kind}/id2222`).expect(200);
    assert.deepEqual(
      inputs[0]?.query,
      kind === 'onepager' ? {} : { language: 'en' },
    );
    const response = await request(app)
      .head(`/pdf/${kind}/id2222`)
      .query(kind === 'onepager' ? { START: '2027-01-01' } : { year: '2027' })
      .expect(200);
    assert.match(response.headers['content-disposition'], /id2222\.pdf/);
    assert.equal(inputs.length, 1);
  });

  test(`${kind} rejects invalid or undeclared parameters before rendering`, async () => {
    const { app, inputs } = setup();
    for (const query of [
      'landscape=true',
      'route=/other',
      'year=1999',
      'language=',
      'language=en&language=de',
      'year=2027&year=2028',
    ]) {
      await request(app).get(`/pdf/${kind}/id2222?${query}`).expect(400);
    }
    await request(app).get(`/pdf/${kind}/bad.id`).expect(400);
    await request(app).head(`/pdf/${kind}/id2222?unexpected=1`).expect(400);
    assert.equal(inputs.length, 0);
  });
}

test('quarterly owns its schema and maps direct query parameters', async () => {
  const { app, inputs } = setup();
  await request(app)
    .get('/pdf/quarterly?year=2027&quarter=2&language=pl')
    .expect(200);
  assert.equal(inputs[0]?.route, '/reports/quarterly');
  assert.deepEqual(inputs[0]?.query, {
    year: '2027',
    quarter: '2',
    language: 'pl',
  });
  assert.equal(inputs[0]?.filename, 'quarterly-2027-q2-pl');
  assert.equal(inputs[0]?.landscape, false);
  assert.equal(inputs[0]?.print?.landscape, false);
  await request(app).get('/pdf/quarterly?unexpected=1').expect(400);
  assert.equal(inputs.length, 1);
});

test('onepager accepts each optional parameter independently and both benchmarks', async () => {
  const { app, inputs } = setup();
  for (const parameters of [
    { START: '2024-02-29' },
    { END: '2027-12-31' },
    { BENCHMARK: 'SAA' },
    { BENCHMARK: 'REPORTING' },
  ]) {
    await request(app)
      .get('/pdf/onepager/id2222')
      .query(parameters)
      .expect(200);
    assert.deepEqual(inputs.at(-1)?.query, parameters);
  }
});

test('onepager uses the request time in a filename-safe download name', async (t) => {
  t.mock.timers.enable({
    apis: ['Date'],
    now: new Date('2024-02-29T23:59:00Z'),
  });
  const { app, inputs } = setup();
  const first = await request(app).get('/pdf/onepager/id2222').expect(200);
  assert.match(
    first.headers['content-disposition'],
    /onepager-2024-02-29-23-59-id2222\.pdf/,
  );
  t.mock.timers.setTime(new Date('2024-03-01T00:01:00Z').getTime());
  const second = await request(app).head('/pdf/onepager/id2222').expect(200);
  assert.match(
    second.headers['content-disposition'],
    /onepager-2024-03-01-00-01-id2222\.pdf/,
  );
  assert.equal(inputs.length, 1);
});

test('onepager preserves a maximum-length document ID in its download name', async () => {
  const { app, inputs } = setup();
  const id = 'a'.repeat(80);
  const response = await request(app).get(`/pdf/onepager/${id}`).expect(200);
  assert.ok(response.headers['content-disposition'].includes(`${id}.pdf`));
  assert.equal(inputs[0]?.filename, id);
  assert.equal(inputs[0]?.route, `/onepager/${id}`);
});

test('onepager rejects removed language/year, invalid dates, benchmark values and duplicate parameters', async () => {
  const { app, inputs } = setup();
  for (const query of [
    'year=2027',
    'language=en',
    'START=2027-2-01',
    'START=2027-02-29',
    'END=2027-04-31',
    'END=2027-01-01T00:00:00Z',
    'START=',
    'END=',
    'BENCHMARK=',
    'BENCHMARK=saa',
    'BENCHMARK=OTHER',
    'START=2027-01-01&START=2027-01-02',
    'END=2027-01-01&END=2027-01-02',
    'BENCHMARK=SAA&BENCHMARK=REPORTING',
    'start=2027-01-01',
  ]) {
    await request(app).get(`/pdf/onepager/id2222?${query}`).expect(400);
    await request(app).head(`/pdf/onepager/id2222?${query}`).expect(400);
  }
  assert.equal(inputs.length, 0);
});

test('report definitions reject orientation supplied through prepareInput', async () => {
  let renders = 0;
  const factory = definePdfReport({
    schema: z.object({}).strict(),
    // @ts-expect-error Orientation must be defined through print.landscape.
    prepareInput: () => ({ route: '/report', landscape: false }),
    print: { landscape: true },
  });
  const app = createApp(
    {
      pdf: {
        generate: async () => {
          renders++;
          return Buffer.from('%PDF-test');
        },
      },
      logger: { error() {} },
    },
    [{ method: 'get', path: '/report', file: 'report/get.ts', factory }],
  );
  await request(app).get('/report').expect(400);
  assert.equal(renders, 0);
});
