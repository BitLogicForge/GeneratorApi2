import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { DOMParser } from '@xmldom/xmldom';
import JSZip from 'jszip';
import request from 'supertest';

import { createApp } from '@/app';
import { drawing } from '@/pptx/jszip/package/namespaces';
import { PowerPointTemplateService } from '@/services/jszip/power-point-template-service';

test('PowerPoint GET and POST reject XML-forbidden text before generation', async () => {
  let calls = 0;
  const generate = async () => {
    calls++;
    return Buffer.alloc(0);
  };
  const app = createApp({
    pdf: { generate },
    presentations: { generate },
    templatePresentations: { generate },
    templateReportDemo: { generate },
  });
  const invalid = [
    ...Array.from({ length: 32 }, (_, code) =>
      String.fromCharCode(code),
    ).filter((value) => !['\t', '\n', '\r'].includes(value)),
    '\ud800',
    '\udfff',
    '\ufffe',
    '\uffff',
  ];
  for (const character of invalid) {
    for (const method of ['get', 'post'] as const) {
      const call = request(app)[method]('/api/exports/pptx/jszip/summary');
      const replacements = {
        title: `A${character}B`,
        subtitle: 'Summary',
        customer: 'Acme',
      };
      if (method === 'get')
        call.query({ replacements: JSON.stringify(replacements) });
      else call.send({ replacements });
      const response = await call.expect(400);
      assert.equal(response.body.error.code, 'VALIDATION_ERROR');
      assert.deepEqual(response.body.error.details[0].path, [
        'replacements',
        'title',
      ]);
      assert.equal(
        response.body.error.requestId,
        response.headers['x-request-id'],
      );
    }
  }
  await request(app)
    .get('/api/exports/pptx/jszip/daa')
    .query({ TEXT_ME: 'A\u0001B' })
    .expect(400);
  const payload = {
    title: 'Brief',
    subtitle: '',
    author: 'Author',
    slides: [{ title: 'Slide', bullets: ['Bullet'], notes: 'Notes' }],
  };
  const inputs = [
    { ...payload, title: '\u0001' },
    { ...payload, subtitle: '\u0001' },
    { ...payload, author: '\u0001' },
    { ...payload, slides: [{ ...payload.slides[0], title: '\u0001' }] },
    { ...payload, slides: [{ ...payload.slides[0], bullets: ['\u0001'] }] },
    { ...payload, slides: [{ ...payload.slides[0], notes: '\u0001' }] },
  ];
  for (const input of inputs) {
    await request(app)
      .post('/api/exports/pptx/pptxgenjs/brief')
      .send(input)
      .expect(400);
    await request(app)
      .get('/api/exports/pptx/pptxgenjs/brief')
      .query({ ...input, slides: JSON.stringify(input.slides) })
      .expect(400);
  }
  assert.equal(calls, 0);
});

test('permitted whitespace and Unicode survive GET and POST template exports', async () => {
  const app = createApp({
    pdf: { generate: async () => Buffer.alloc(0) },
    presentations: { generate: async () => Buffer.alloc(0) },
    templatePresentations: new PowerPointTemplateService({
      summary: fileURLToPath(
        new URL('../../templates/summary.pptx', import.meta.url),
      ),
    }),
  });
  const title = 'Line\tone\n日本語 😀 & <report>';
  const replacements = { title, subtitle: 'Summary', customer: 'Acme' };
  for (const method of ['get', 'post'] as const) {
    const call = request(app)[method]('/api/exports/pptx/jszip/summary');
    if (method === 'get')
      call.query({ replacements: JSON.stringify(replacements) });
    else call.send({ replacements });
    const response = await call
      .buffer(true)
      .parse((res, done) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => done(null, Buffer.concat(chunks)));
      })
      .expect(200);
    const zip = await JSZip.loadAsync(response.body);
    const xml = await zip.file('ppt/slides/slide1.xml')!.async('string');
    const document = new DOMParser().parseFromString(xml, 'application/xml');
    assert.ok(
      Array.from(document.getElementsByTagNameNS(drawing, 't')).some(
        (node) => node.textContent === title,
      ),
    );
  }
});
