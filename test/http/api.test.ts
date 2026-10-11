import assert from 'node:assert/strict';
import { test } from 'node:test';

import JSZip from 'jszip';
import request from 'supertest';

import { createApp } from '@/app';
import { AppError } from '@/errors';
import { PowerPointGenerationService } from '@/services/pptxgenjs/power-point-generation-service';

const payload = {
  title: 'Roadmap',
  slides: [
    {
      title: 'Next steps',
      bullets: ['Ship the API'],
      notes: 'Discuss priorities',
    },
  ],
};
const app = createApp({
  pdf: { generate: async () => Buffer.from('%PDF-1.7') },
  presentations: new PowerPointGenerationService(),
  logger: { error() {} },
});
test('PowerPoint routes select fixed templates for GET and POST', async () => {
  const templates: string[] = [];
  const fixedApp = createApp({
    pdf: { generate: async () => Buffer.alloc(0) },
    presentations: {
      generate: async (template) => {
        templates.push(template);
        return Buffer.from('pptx');
      },
    },
    templatePresentations: {
      generate: async (template) => {
        templates.push(template);
        return Buffer.from('pptx');
      },
    },
  });
  await request(fixedApp)
    .get('/api/exports/pptx/pptxgenjs/brief')
    .query({ title: payload.title, slides: JSON.stringify(payload.slides) })
    .expect(200);
  await request(fixedApp)
    .post('/api/exports/pptx/pptxgenjs/brief')
    .send(payload)
    .expect(200);
  await request(fixedApp)
    .get('/api/exports/pptx/jszip/business')
    .query({ replacements: JSON.stringify({ title: 'Proposal' }) })
    .expect(200);
  await request(fixedApp)
    .post('/api/exports/pptx/jszip/business')
    .send({ replacements: { title: 'Proposal' } })
    .expect(200);
  assert.deepEqual(templates, ['brief', 'brief', 'business', 'business']);
  for (const path of [
    '/demo-report.pptx',
    '/api/exports/pptx/generated/brief',
    '/api/exports/pptx/templates/business',
    '/api/exports/pptx/pptxgenjs/other',
    '/api/exports/pptx/jszip/other',
  ]) {
    const get = await request(fixedApp).get(path).expect(404);
    const post = await request(fixedApp).post(path).send({}).expect(404);
    assert.equal(get.body.error.code, 'NOT_FOUND');
    assert.equal(post.body.error.code, 'NOT_FOUND');
    assert.ok(get.headers['x-request-id']);
    assert.ok(post.headers['x-request-id']);
  }
  assert.equal(templates.length, 4);
});
test('health and PDF download contract', async () => {
  await request(app).get('/health').expect(200, { status: 'ok' });
  const res = await request(app)
    .post('/api/exports/pdf/test')
    .send({ route: '/report', filename: 'report' })
    .expect(200);
  assert.match(res.headers['content-type'], /application\/pdf/);
  assert.match(res.headers['content-disposition'], /report.pdf/);
});
test('PowerPoint contains editable title, content and notes', async () => {
  const res = await request(app)
    .post('/api/exports/pptx/pptxgenjs/brief')
    .send(payload)
    .buffer(true)
    .parse((res, done) => {
      const chunks: Buffer[] = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => done(null, Buffer.concat(chunks)));
    })
    .expect(200);
  const zip = await JSZip.loadAsync(res.body);
  assert.match(
    await zip.file('ppt/slides/slide1.xml')!.async('string'),
    /Roadmap/,
  );
  assert.match(
    await zip.file('ppt/slides/slide2.xml')!.async('string'),
    /Ship the API/,
  );
  assert.match(
    await zip.file('ppt/notesSlides/notesSlide2.xml')!.async('string'),
    /Discuss priorities/,
  );
});
test('invalid inputs, malformed JSON and unknown templates', async () => {
  for (const route of [
    'https://example.com',
    '//example.com',
    '/\\example.com',
  ]) {
    await request(app)
      .post('/api/exports/pdf/test')
      .send({ route })
      .expect(400);
  }
  await request(app)
    .post('/api/exports/pdf/test')
    .send({ route: '/ok', filename: '../bad' })
    .expect(400);
  await request(app)
    .post('/api/exports/pptx/pptxgenjs/brief')
    .send({ ...payload, slides: [] })
    .expect(400);
  await request(app)
    .post('/api/exports/pptx/pptxgenjs/missing')
    .send(payload)
    .expect(404);
  await request(app)
    .post('/api/exports/pdf/test')
    .set('Content-Type', 'application/json')
    .send('{')
    .expect(400);
});
test('service errors keep consistent response without leaking internals', async () => {
  const failing = createApp({
    pdf: {
      generate: async () => {
        throw new AppError(503, 'RENDER_BUSY', 'Renderer is busy');
      },
    },
    presentations: new PowerPointGenerationService(),
    logger: { error() {} },
  });
  const res = await request(failing)
    .post('/api/exports/pdf/test')
    .send({ route: '/ok' })
    .expect(503);
  assert.equal(res.body.error.code, 'RENDER_BUSY');
  assert.equal(res.body.error.requestId, res.headers['x-request-id']);
});

test('GET generation endpoints decode query inputs and return attachments', async () => {
  const inputs: unknown[] = [];
  const getApp = createApp({
    pdf: {
      generate: async (input) => {
        inputs.push(input);
        return Buffer.from('%PDF-1.7');
      },
    },
    presentations: new PowerPointGenerationService(),
    templatePresentations: {
      generate: async (template, input) => {
        inputs.push({ template, ...input });
        return Buffer.from('pptx');
      },
    },
  });
  const pdf = await request(getApp)
    .get('/api/exports/pdf/test')
    .query({
      route: '/report',
      query: JSON.stringify({ year: 2026, print: true }),
      landscape: 'false',
      filename: 'report',
    })
    .expect(200);
  assert.match(pdf.headers['content-disposition'], /report.pdf/);
  assert.deepEqual(inputs[0], {
    route: '/report',
    query: { year: 2026, print: true },
    landscape: false,
    filename: 'report',
    format: 'A4',
  });
  const deck = await request(getApp)
    .get('/api/exports/pptx/pptxgenjs/brief')
    .query({ title: payload.title, slides: JSON.stringify(payload.slides) })
    .buffer(true)
    .parse((res, done) => {
      const chunks: Buffer[] = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => done(null, Buffer.concat(chunks)));
    })
    .expect(200);
  const zip = await JSZip.loadAsync(deck.body);
  assert.match(
    await zip.file('ppt/slides/slide2.xml')!.async('string'),
    /Ship the API/,
  );
  const template = await request(getApp)
    .get('/api/exports/pptx/jszip/business')
    .query({
      replacements: JSON.stringify({ title: 'A & B' }),
      filename: 'proposal',
    })
    .expect(200);
  assert.match(template.headers['content-disposition'], /proposal.pptx/);
  assert.deepEqual(inputs[1], {
    template: 'business',
    replacements: { title: 'A & B' },
    filename: 'proposal',
  });
});

test('GET generation rejects malformed, duplicate, unknown and invalid query inputs', async () => {
  for (const query of [
    'route=/report&query=bad-json',
    'route=/report&landscape=1',
    'route=/report&route=/other',
    'route=/report&unknown=value',
    'route=https://example.com',
  ])
    await request(app).get(`/api/exports/pdf/test?${query}`).expect(400);
  await request(app)
    .get('/api/exports/pptx/pptxgenjs/brief')
    .query({ title: 'Test', slides: '[]' })
    .expect(400);
  await request(app)
    .get('/api/exports/pptx/pptxgenjs/missing')
    .query({ title: payload.title, slides: JSON.stringify(payload.slides) })
    .expect(404);
  await request(app)
    .get('/api/exports/pptx/jszip/business')
    .query({ replacements: '{' })
    .expect(400);
});

test('each export decodes only its own declared structured query fields', async () => {
  const cases = [
    {
      path: '/api/exports/pdf/test',
      valid: { route: '/report' },
      own: 'query',
      other: 'slides',
    },
    {
      path: '/api/exports/pptx/pptxgenjs/brief',
      valid: { title: 'Test', slides: JSON.stringify(payload.slides) },
      own: 'slides',
      other: 'query',
    },
    {
      path: '/api/exports/pptx/jszip/business',
      valid: { replacements: JSON.stringify({ title: 'Test' }) },
      own: 'replacements',
      other: 'landscape',
    },
    {
      path: '/api/exports/pptx/jszip/summary',
      valid: { replacements: JSON.stringify({ title: 'Test' }) },
      own: 'replacements',
      other: 'query',
    },
  ];
  for (const item of cases) {
    const invalidJson = await request(app)
      .get(item.path)
      .query({ ...item.valid, [item.own]: 'not-json' })
      .expect(400);
    assert.equal(invalidJson.body.error.code, 'INVALID_QUERY_PARAMETER');
    const unknownField = await request(app)
      .get(item.path)
      .query({ ...item.valid, [item.other]: 'not-json' })
      .expect(400);
    assert.equal(unknownField.body.error.code, 'VALIDATION_ERROR');
    await request(app)
      .head(item.path)
      .query({ ...item.valid, [item.other]: 'not-json' })
      .expect(400);
  }
});
