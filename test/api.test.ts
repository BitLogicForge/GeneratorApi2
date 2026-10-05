import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import JSZip from 'jszip';
import { createApp } from '../src/app.js';
import { PresentationService } from '../src/services/presentation.js';
import { AppError } from '../src/errors.js';
const payload = { title: 'Roadmap', slides: [{ title: 'Next steps', bullets: ['Ship the API'], notes: 'Discuss priorities' }] };
const app = createApp({ pdf: { generate: async () => Buffer.from('%PDF-1.7') }, presentations: new PresentationService(), logger: { error() {} } });
test('health and PDF download contract', async () => {
  await request(app).get('/health').expect(200, { status: 'ok' });
  const res = await request(app).post('/api/pdf').send({ route: '/report', filename: 'report' }).expect(200);
  assert.match(res.headers['content-type'], /application\/pdf/);
  assert.match(res.headers['content-disposition'], /report.pdf/);
});
test('PowerPoint contains editable title, content and notes', async () => {
  const res = await request(app).post('/api/presentations/brief').send(payload).buffer(true).parse((res, done) => {
    const chunks: Buffer[] = []; res.on('data', c => chunks.push(c)); res.on('end', () => done(null, Buffer.concat(chunks)));
  }).expect(200);
  const zip = await JSZip.loadAsync(res.body);
  assert.match(await zip.file('ppt/slides/slide1.xml')!.async('string'), /Roadmap/);
  assert.match(await zip.file('ppt/slides/slide2.xml')!.async('string'), /Ship the API/);
  assert.match(await zip.file('ppt/notesSlides/notesSlide2.xml')!.async('string'), /Discuss priorities/);
});
test('invalid inputs, malformed JSON and unknown templates', async () => {
  for (const route of ['https://example.com', '//example.com', '/\\example.com']) {
    await request(app).post('/api/pdf').send({ route }).expect(400);
  }
  await request(app).post('/api/pdf').send({ route: '/ok', filename: '../bad' }).expect(400);
  await request(app).post('/api/presentations/brief').send({ ...payload, slides: [] }).expect(400);
  await request(app).post('/api/presentations/missing').send(payload).expect(404);
  await request(app).post('/api/pdf').set('Content-Type', 'application/json').send('{').expect(400);
});
test('service errors keep consistent response without leaking internals', async () => {
  const failing = createApp({ pdf: { generate: async () => { throw new AppError(503, 'RENDER_BUSY', 'Renderer is busy'); } }, presentations: new PresentationService(), logger: { error() {} } });
  const res = await request(failing).post('/api/pdf').send({ route: '/ok' }).expect(503);
  assert.equal(res.body.error.code, 'RENDER_BUSY');
  assert.equal(res.body.error.requestId, res.headers['x-request-id']);
});
