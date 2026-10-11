import { test } from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import PptxGenJS from 'pptxgenjs';
import { replacePlaceholders } from '@/pptx/jszip/placeholders';
import { listSlides } from '@/pptx/jszip/slides/list';
import { duplicateSlide } from '@/pptx/jszip/slides/duplicate';
import { removeSlide } from '@/pptx/jszip/slides/remove';
import { readXml } from '@/pptx/jszip/package/read-xml';
import { resolveRelationship } from '@/pptx/jszip/package/resolve-relationship';

test('removed slides do not require placeholder replacements and last slide cannot be removed', async () => {
  const pptx = new PptxGenJS();
  pptx.addSlide().addText('{{removed}}', { x: 1, y: 1, w: 3, h: 1 });
  pptx.addSlide().addText('{{kept}}', { x: 1, y: 1, w: 3, h: 1 });
  const zip = await JSZip.loadAsync(
    (await pptx.write({ outputType: 'nodebuffer' })) as Buffer,
  );
  const [removed, kept] = await listSlides(zip);
  await removeSlide(zip, removed);
  await replacePlaceholders(zip, { kept: 'Result' });
  assert.match(await zip.file(kept)!.async('string'), /Result/);
  await assert.rejects(removeSlide(zip, kept), { code: 'INVALID_TEMPLATE' });
});

test('notes are duplicated with a backlink to their new slide', async () => {
  const pptx = new PptxGenJS();
  const slide = pptx.addSlide();
  slide.addText('Title', { x: 1, y: 1, w: 3, h: 1 });
  slide.addNotes('Author notes');
  const zip = await JSZip.loadAsync(
    (await pptx.write({ outputType: 'nodebuffer' })) as Buffer,
  );
  const [source] = await listSlides(zip);
  const copy = await duplicateSlide(zip, source);
  const notePath = async (path: string) => {
    const relationships = await readXml(
      zip,
      path.replace('/slides/', '/slides/_rels/') + '.rels',
    );
    const relation = Array.from(
      relationships.getElementsByTagName('Relationship'),
    ).find((node) => node.getAttribute('Type')?.endsWith('/notesSlide'))!;
    return resolveRelationship(
      zip,
      path,
      relation.getAttribute('Id'),
      'notesSlide',
    );
  };
  const originalNotes = await notePath(source);
  const copiedNotes = await notePath(copy);
  assert.notEqual(copiedNotes, originalNotes);
  assert.match(await zip.file(copiedNotes)!.async('string'), /Author notes/);
  const relationships = await readXml(
    zip,
    copiedNotes.replace('/notesSlides/', '/notesSlides/_rels/') + '.rels',
  );
  const backlink = Array.from(
    relationships.getElementsByTagName('Relationship'),
  ).find((node) => node.getAttribute('Type')?.endsWith('/slide'))!;
  assert.equal(
    await resolveRelationship(
      zip,
      copiedNotes,
      backlink.getAttribute('Id'),
      'slide',
    ),
    copy,
  );
});
