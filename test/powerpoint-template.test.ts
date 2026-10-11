import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import JSZip from 'jszip';
import request from 'supertest';
import { DOMParser } from '@xmldom/xmldom';
import { PowerPointTemplateService } from '../src/pptx/jszip/powerpoint-template.js';
import { templatePresentationSchema } from '../src/schemas.js';
import { createApp } from '../src/app.js';

const path = new URL('../templates/business.pptx', import.meta.url).pathname;
const service = new PowerPointTemplateService({ business: path });
const input = templatePresentationSchema.parse({
  replacements: {
    title: 'Revenue & growth <2026>',
    subtitle: 'Our strategy',
    customer: 'Acme',
  },
});

test('file template replacements preserve untouched parts and source file', async () => {
  const source = await readFile(path);
  const before = await JSZip.loadAsync(source);
  const output = await service.generate('business', input);
  const after = await JSZip.loadAsync(output);
  assert.deepEqual(
    Object.keys(after.files).sort(),
    Object.keys(before.files).sort(),
  );
  const slide = await after.file('ppt/slides/slide1.xml')!.async('string');
  assert.match(slide, /Revenue &amp; growth &lt;2026&gt;/);
  assert.match(slide, /Our strategy/);
  assert.match(slide, /Prepared for Acme/);
  assert.doesNotMatch(slide, /\{\{/);
  assert.match(
    await after.file('ppt/notesSlides/notesSlide1.xml')!.async('string'),
    /Presenting to Acme/,
  );
  for (const name of Object.keys(before.files).filter(
    (name) =>
      !/ppt\/(slides|notesSlides)\/.*\.xml$/.test(name) &&
      !before.files[name].dir,
  )) {
    assert.deepEqual(
      await after.file(name)!.async('nodebuffer'),
      await before.file(name)!.async('nodebuffer'),
      name,
    );
  }
  assert.deepEqual(await readFile(path), source);
});

test('split and repeated placeholders preserve text-run formatting and escape replacement text', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'pptx-template-test-'));
  try {
    const zip = await JSZip.loadAsync(await readFile(path));
    zip.file(
      'ppt/slides/slide1.xml',
      `<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:p><a:r><a:rPr b="1"/><a:t>Before {{ti</a:t></a:r><a:r><a:rPr i="1"/><a:t>tle}} after {{title}}!</a:t></a:r></a:p></p:sld>`,
    );
    const file = join(dir, 'split.pptx');
    await writeFile(file, await zip.generateAsync({ type: 'nodebuffer' }));
    const editor = new PowerPointTemplateService({ split: file });
    const result = await JSZip.loadAsync(
      await editor.generate(
        'split',
        templatePresentationSchema.parse({
          replacements: { title: 'A & B', customer: 'Acme' },
        }),
      ),
    );
    const xml = await result.file('ppt/slides/slide1.xml')!.async('string');
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    const ns = 'http://schemas.openxmlformats.org/drawingml/2006/main';
    assert.equal(
      Array.from(doc.getElementsByTagNameNS(ns, 't'))
        .map((n) => n.textContent)
        .join(''),
      'Before A & B after A & B!',
    );
    assert.match(xml, /b="1"/);
    assert.match(xml, /i="1"/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('template names and replacement keys are validated', async () => {
  await assert.rejects(service.generate('../business', input), {
    code: 'UNKNOWN_TEMPLATE',
  });
  await assert.rejects(
    service.generate(
      'business',
      templatePresentationSchema.parse({
        replacements: { title: 'Only title' },
      }),
    ),
    { code: 'MISSING_REPLACEMENTS' },
  );
  await assert.rejects(
    service.generate('business', {
      ...input,
      replacements: { ...input.replacements, typo: 'Oops' },
    }),
    { code: 'UNKNOWN_PLACEHOLDERS' },
  );
});

test('template endpoint returns an edited PPTX attachment', async () => {
  const app = createApp({
    templatePresentations: service,
    pdf: { generate: async () => Buffer.alloc(0) },
    presentations: { generate: async () => Buffer.alloc(0) },
  });
  const response = await request(app)
    .post('/api/exports/pptx/templates/business')
    .send(input)
    .expect(200);
  assert.match(response.headers['content-disposition'], /presentation.pptx/);
  assert.match(response.headers['content-type'], /presentationml/);
  await request(app)
    .post('/api/exports/pptx/templates/business')
    .send({ replacements: {} })
    .expect(400);
  await request(app)
    .post('/api/exports/pptx/templates/unknown')
    .send(input)
    .expect(404);
});
