import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import JSZip from 'jszip';
import { createApp } from '@/app';
import { GeneratedPresentationService } from '@/pptx/pptxgenjs/generated-presentation';
import { AppError } from '@/errors';
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
  presentations: new GeneratedPresentationService(),
  logger: { error() {} },
});
test('health and PDF download contract', async () => {
  await request(app).get('/health').expect(200, { status: 'ok' });
  const res = await request(app)
    .post('/api/exports/pdf')
    .send({ route: '/report', filename: 'report' })
    .expect(200);
  assert.match(res.headers['content-type'], /application\/pdf/);
  assert.match(res.headers['content-disposition'], /report.pdf/);
});
test('PowerPoint contains editable title, content and notes', async () => {
  const res = await request(app)
    .post('/api/exports/pptx/generated/brief')
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
    await request(app).post('/api/exports/pdf').send({ route }).expect(400);
  }
  await request(app)
    .post('/api/exports/pdf')
    .send({ route: '/ok', filename: '../bad' })
    .expect(400);
  await request(app)
    .post('/api/exports/pptx/generated/brief')
    .send({ ...payload, slides: [] })
    .expect(400);
  await request(app)
    .post('/api/exports/pptx/generated/missing')
    .send(payload)
    .expect(404);
  await request(app)
    .post('/api/exports/pdf')
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
    presentations: new GeneratedPresentationService(),
    logger: { error() {} },
  });
  const res = await request(failing)
    .post('/api/exports/pdf')
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
    presentations: new GeneratedPresentationService(),
    templatePresentations: {
      generate: async (template, input) => {
        inputs.push({ template, ...input });
        return Buffer.from('pptx');
      },
    },
  });
  const pdf = await request(getApp)
    .get('/api/exports/pdf')
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
    .get('/api/exports/pptx/generated/brief')
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
    .get('/api/exports/pptx/templates/business')
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
    await request(app).get(`/api/exports/pdf?${query}`).expect(400);
  await request(app)
    .get('/api/exports/pptx/generated/brief')
    .query({ title: 'Test', slides: '[]' })
    .expect(400);
  await request(app)
    .get('/api/exports/pptx/generated/missing')
    .query({ title: payload.title, slides: JSON.stringify(payload.slides) })
    .expect(404);
  await request(app)
    .get('/api/exports/pptx/templates/business')
    .query({ replacements: '{' })
    .expect(400);
});
