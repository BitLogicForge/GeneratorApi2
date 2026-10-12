import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import JSZip from 'jszip';
import request from 'supertest';
import { z } from 'zod';

import { createApp } from '@/app';
import { definePptxReport } from '@/reports/pptx';
import { createReportServices } from '@/reports/services';
import businessFactory, {
  report as business,
} from '@/routes/pptx/jszip/business/report';
import { report as daa } from '@/routes/pptx/jszip/daa/report';
import { report as summary } from '@/routes/pptx/jszip/summary/report';
import briefFactory, {
  report as brief,
} from '@/routes/pptx/pptxgenjs/brief/report';

import type { Response } from 'supertest';

function parseBinary(
  response: Response,
  done: (error: Error | null, body?: Buffer) => void,
) {
  const chunks: Buffer[] = [];
  response.on('data', (chunk: Buffer) => chunks.push(chunk));
  response.on('end', () => done(null, Buffer.concat(chunks)));
  response.on('error', (error: Error) => done(error));
}

function setup() {
  const calls: { target: string; input: unknown }[] = [];
  const capture = (target: string) => async (input: unknown) => {
    calls.push({ target, input });
    return Buffer.from('pptx-test');
  };
  const reports = createReportServices();
  reports.override(business, { generate: capture('business') });
  reports.override(summary, { generate: capture('summary') });
  reports.override(daa, { generate: capture('daa') });
  reports.override(brief, { generate: capture('brief') });
  const app = createApp({
    reports,
    pdf: { generate: async () => Buffer.alloc(0) },
    logger: { error() {} },
  });
  return { app, calls };
}

for (const target of ['business', 'summary']) {
  test(`${target} maps GET and POST into its fixed template and validates HEAD`, async () => {
    const { app, calls } = setup();
    const replacements = {
      title: 'Quarterly results',
      subtitle: 'Review',
      customer: 'Acme',
    };
    const payload = { filename: 'review', replacements };
    const response = await request(app)
      .get(`/pptx/jszip/${target}`)
      .query({ filename: 'review', replacements: JSON.stringify(replacements) })
      .expect(200);
    assert.match(
      response.headers['content-type'],
      /application\/vnd.openxmlformats-officedocument.presentationml.presentation/,
    );
    assert.match(response.headers['content-disposition'], /review\.pptx/);
    assert.equal(response.headers['cache-control'], 'no-store');
    assert.ok(response.headers['x-request-id']);
    await request(app).post(`/pptx/jszip/${target}`).send(payload).expect(200);
    assert.deepEqual(calls, [
      { target, input: payload },
      { target, input: payload },
    ]);
    await request(app)
      .head(`/pptx/jszip/${target}`)
      .query({ replacements: JSON.stringify(replacements) })
      .expect(200);
    assert.equal(calls.length, 2);
    await request(app)
      .post(`/pptx/jszip/${target}`)
      .send({ replacements })
      .expect(200);
    assert.deepEqual(calls.at(-1), {
      target,
      input: { filename: 'presentation', replacements },
    });
  });

  test(`${target} rejects unknown fields, invalid replacements and duplicate query values`, async () => {
    const { app, calls } = setup();
    for (const body of [
      {},
      { replacements: {} },
      { replacements: { title: 42 } },
      { replacements: { title: 'Valid' }, template: '../other' },
      { replacements: { title: 'Valid' }, filename: '../unsafe' },
    ]) {
      await request(app).post(`/pptx/jszip/${target}`).send(body).expect(400);
    }
    await request(app)
      .get(`/pptx/jszip/${target}?replacements=invalid`)
      .expect(400);
    await request(app)
      .get(`/pptx/jszip/${target}?replacements=%7B%7D&replacements=%7B%7D`)
      .expect(400);
    await request(app).head(`/pptx/jszip/${target}`).expect(400);
    assert.equal(calls.length, 0);
  });
}

const slides = [
  { title: 'Results', bullets: ['Revenue increased'], notes: 'Editable notes' },
];

test('brief maps GET and POST to its fixed design with route defaults', async () => {
  const { app, calls } = setup();
  const input = { title: 'Review', slides };
  await request(app)
    .get('/pptx/pptxgenjs/brief')
    .query({ title: input.title, slides: JSON.stringify(slides) })
    .expect(200);
  await request(app).post('/pptx/pptxgenjs/brief').send(input).expect(200);
  const expected = {
    target: 'brief',
    input: {
      ...input,
      filename: 'presentation',
      subtitle: '',
      author: 'Generator API',
      accent: '2563EB',
    },
  };
  assert.deepEqual(calls, [expected, expected]);
  await request(app)
    .head('/pptx/pptxgenjs/brief')
    .query({ title: input.title, slides: JSON.stringify(slides) })
    .expect(200);
  assert.equal(calls.length, 2);
  await request(app)
    .post('/pptx/pptxgenjs/brief')
    .send({ ...input, template: 'other' })
    .expect(400);
  await request(app)
    .get('/pptx/pptxgenjs/brief?title=A&title=B&slides=[]')
    .expect(400);
  await request(app)
    .post('/pptx/pptxgenjs/brief')
    .send({ ...input, slides: [{ title: 'Results', bullets: [] }] })
    .expect(400);
  assert.equal(calls.length, 2);
});

test('DAA maps TEXT_ME into generator text and uses its fixed filename', async () => {
  const { app, calls } = setup();
  const response = await request(app)
    .get('/pptx/jszip/daa?TEXT_ME=Hello%20world')
    .expect(200);
  assert.match(response.headers['content-disposition'], /demo-report\.pptx/);
  await request(app).get('/pptx/jszip/daa').expect(200);
  assert.deepEqual(calls, [
    { target: 'daa', input: 'Hello world' },
    { target: 'daa', input: 'Generated report' },
  ]);
  await request(app).head('/pptx/jszip/daa?TEXT_ME=Hello').expect(200);
  await request(app).get('/pptx/jszip/daa?TEXT_ME=A&TEXT_ME=B').expect(400);
  await request(app).get('/pptx/jszip/daa?filename=other').expect(400);
  assert.equal(calls.length, 2);
});

test('legacy service injections still receive mapped PPTX inputs', async () => {
  const calls: unknown[] = [];
  const app = createApp({
    pdf: { generate: async () => Buffer.alloc(0) },
    templatePresentations: {
      generate: async (template, input) => {
        calls.push({ template, input });
        return Buffer.alloc(1);
      },
    },
    presentations: {
      generate: async (template, input) => {
        calls.push({ template, input });
        return Buffer.alloc(1);
      },
    },
    templateReportDemo: {
      generate: async (text) => {
        calls.push(text);
        return Buffer.alloc(1);
      },
    },
    logger: { error() {} },
  });
  await request(app)
    .post('/pptx/jszip/business')
    .send({ replacements: { title: 'Test' } })
    .expect(200);
  await request(app)
    .post('/pptx/pptxgenjs/brief')
    .send({ title: 'Review', slides })
    .expect(200);
  await request(app).get('/pptx/jszip/daa?TEXT_ME=Hello').expect(200);
  assert.deepEqual(calls[0], {
    template: 'business',
    input: { filename: 'presentation', replacements: { title: 'Test' } },
  });
  assert.equal((calls[1] as { template: string }).template, 'brief');
  assert.equal(calls[2], 'Hello');
});

test('GET and POST share one service and mapping does not alter lifecycle handling', async () => {
  let creates = 0;
  let validations = 0;
  let closes = 0;
  const inputs: string[] = [];
  const definition = {
    schema: z.object({ title: z.string() }).strict(),
    prepareInput: ({ title }: { title: string }) => ({
      filename: 'mapped-report',
      input: title,
    }),
    createService: () => {
      creates++;
      return {
        generate: async (input: string) => {
          inputs.push(input);
          return Buffer.alloc(1);
        },
        validate: async () => {
          validations++;
        },
        close: async () => {
          closes++;
        },
      };
    },
  };
  const factory = definePptxReport(definition);
  const reports = createReportServices();
  const app = createApp(
    {
      reports,
      pdf: { generate: async () => Buffer.alloc(0) },
      logger: { error() {} },
    },
    [
      { method: 'get', path: '/mapped', file: 'mapped/get.ts', factory },
      { method: 'post', path: '/mapped', file: 'mapped/post.ts', factory },
    ],
  );
  await reports.initialize();
  await request(app).get('/mapped?title=GET').expect(200);
  await request(app).post('/mapped').send({ title: 'POST' }).expect(200);
  await request(app).head('/mapped?title=HEAD').expect(200);
  await reports.close();
  assert.deepEqual(inputs, ['GET', 'POST']);
  assert.equal(creates, 1);
  assert.equal(validations, 1);
  assert.equal(closes, 1);
});

test('business generation edits slide text and preserves the source presentation', async () => {
  const source = new URL('../../templates/business.pptx', import.meta.url);
  const before = await readFile(source);
  const reports = createReportServices();
  const app = createApp(
    {
      reports,
      pdf: { generate: async () => Buffer.alloc(0) },
      logger: { error() {} },
    },
    [
      {
        method: 'post',
        path: '/business',
        file: 'business/post.ts',
        factory: businessFactory,
      },
    ],
  );
  try {
    await reports.initialize();
    const response = await request(app)
      .post('/business')
      .buffer(true)
      .parse(parseBinary)
      .send({
        replacements: {
          title: 'Mapped title',
          subtitle: 'Mapped subtitle',
          customer: 'Mapped customer',
        },
      })
      .expect(200);
    const zip = await JSZip.loadAsync(response.body as Buffer);
    const xml = (
      await Promise.all(
        Object.values(zip.files)
          .filter((file) => /^ppt\/slides\/slide\d+\.xml$/.test(file.name))
          .map((file) => file.async('string')),
      )
    ).join('\n');
    assert.match(xml, /Mapped title/);
    assert.match(xml, /Mapped customer/);
    assert.deepEqual(await readFile(source), before);
  } finally {
    await reports.close();
  }
});

test('brief generation retains editable slide and notes XML', async () => {
  const reports = createReportServices();
  const app = createApp(
    {
      reports,
      pdf: { generate: async () => Buffer.alloc(0) },
      logger: { error() {} },
    },
    [
      {
        method: 'post',
        path: '/brief',
        file: 'brief/post.ts',
        factory: briefFactory,
      },
    ],
  );
  try {
    await reports.initialize();
    const response = await request(app)
      .post('/brief')
      .buffer(true)
      .parse(parseBinary)
      .send({ title: 'Review', slides })
      .expect(200);
    const zip = await JSZip.loadAsync(response.body as Buffer);
    const xml = (
      await Promise.all(
        Object.values(zip.files)
          .filter((file) =>
            /^ppt\/(slides|notesSlides)\/.*\.xml$/.test(file.name),
          )
          .map((file) => file.async('string')),
      )
    ).join('\n');
    assert.match(xml, /Revenue increased/);
    assert.match(xml, /Editable notes/);
    assert.ok(zip.file('ppt/presentation.xml'));
  } finally {
    await reports.close();
  }
});
