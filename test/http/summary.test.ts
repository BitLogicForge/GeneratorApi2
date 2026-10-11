import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import JSZip from 'jszip';
import request from 'supertest';

import { createApp } from '@/app';
import { PowerPointTemplateService } from '@/services/jszip/power-point-template-service';

test('GET and POST summary routes fill the existing template without changing it', async () => {
  const path = new URL('../../templates/summary.pptx', import.meta.url);
  const source = await readFile(path);
  const app = createApp({
    pdf: { generate: async () => Buffer.alloc(0) },
    presentations: { generate: async () => Buffer.alloc(0) },
    templatePresentations: new PowerPointTemplateService({
      summary: fileURLToPath(path),
    }),
  });
  const replacements = {
    title: 'Quarterly summary',
    subtitle: 'Results & outlook',
    customer: 'Acme',
  };
  for (const method of ['get', 'post'] as const) {
    const call = request(app)[method]('/api/exports/pptx/jszip/summary');
    if (method === 'get')
      call.query({
        replacements: JSON.stringify(replacements),
        filename: 'summary',
      });
    else call.send({ replacements, filename: 'summary' });
    const response = await call
      .buffer(true)
      .parse((res, done) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => done(null, Buffer.concat(chunks)));
      })
      .expect(200);
    assert.match(response.headers['content-disposition'], /summary\.pptx/);
    assert.match(response.headers['content-type'], /presentationml/);
    assert.ok(response.headers['x-request-id']);
    const zip = await JSZip.loadAsync(response.body);
    const slide = await zip.file('ppt/slides/slide1.xml')!.async('string');
    assert.match(slide, /Quarterly summary/);
    assert.match(slide, /Results &amp; outlook/);
    assert.match(slide, /Prepared for Acme/);
    assert.doesNotMatch(slide, /\{\{/);
    assert.match(
      await zip.file('ppt/notesSlides/notesSlide1.xml')!.async('string'),
      /Presenting to Acme/,
    );
  }
  assert.deepEqual(await readFile(path), source);
  await request(app)
    .post('/api/exports/pptx/jszip/summary')
    .send({ replacements: { title: 'Incomplete' } })
    .expect(400);
  await request(app)
    .get('/api/exports/pptx/jszip/summary')
    .query({ replacements: '{' })
    .expect(400);
});
