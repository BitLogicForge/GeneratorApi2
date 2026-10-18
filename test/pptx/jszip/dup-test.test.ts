import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { test } from 'node:test';
import JSZip from 'jszip';

import { duplicateSlide } from '@/pptx/jszip/slides/duplicate';
import { listSlides } from '@/pptx/jszip/slides/list';
import { Sample1Service } from '@/services/jszip/Sample1/sample1-service';

test('duplicate slide 2 in template_3.pptx into output as dup_test', async () => {
  const templatePath = 'templates/template_3.pptx';
  const zip = await JSZip.loadAsync(await readFile(templatePath));

  const slidesBefore = await listSlides(zip);
  assert.equal(slidesBefore.length, 4);
  assert.equal(slidesBefore[1], 'ppt/slides/slide2.xml');

  const copy = await duplicateSlide(zip, 2);
  assert.equal(copy, 'ppt/slides/slide5.xml');

  const slidesAfter = await listSlides(zip);
  assert.equal(slidesAfter.length, 5);
  assert.deepEqual(slidesAfter, [
    'ppt/slides/slide1.xml',
    'ppt/slides/slide2.xml',
    'ppt/slides/slide5.xml',
    'ppt/slides/slide3.xml',
    'ppt/slides/slide4.xml',
  ]);

  await mkdir('output', { recursive: true });
  const outputBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  await writeFile('output/dup_test.pptx', outputBuffer);

  const reloaded = await JSZip.loadAsync(await readFile('output/dup_test.pptx'));
  const reloadedSlides = await listSlides(reloaded);
  assert.deepEqual(reloadedSlides, slidesAfter);
});

test('Sample1Service generates presentation with duplicated slide 2 into output as dup_test', async () => {
  const service = new Sample1Service('templates/template_3.pptx');
  await service.validate();

  const buffer = await service.generate({
    title: 'Duplicate Test Report',
    someText: 'Unit test text',
  });

  assert.ok(buffer.length > 0);
  await mkdir('output', { recursive: true });
  await writeFile('output/dup_test.pptx', buffer);

  const zip = await JSZip.loadAsync(buffer);
  const slides = await listSlides(zip);
  assert.equal(slides.length, 5);
  assert.deepEqual(slides, [
    'ppt/slides/slide1.xml',
    'ppt/slides/slide2.xml',
    'ppt/slides/slide5.xml',
    'ppt/slides/slide3.xml',
    'ppt/slides/slide4.xml',
  ]);

  const slide2Xml = await zip.file('ppt/slides/slide2.xml')!.async('string');
  const slide5Xml = await zip.file('ppt/slides/slide5.xml')!.async('string');
  assert.match(slide2Xml, /Page 2/);
  assert.match(slide5Xml, /Page 2 \(Duplicate\)/);
});
