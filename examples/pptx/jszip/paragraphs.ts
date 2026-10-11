import { mkdir, readFile, writeFile } from 'node:fs/promises';

import JSZip from 'jszip';

import { findNamedObjects } from '@/pptx/jszip/objects';
import { writeXml } from '@/pptx/jszip/package/write-xml';
import { fillParagraphs } from '@/pptx/jszip/text/fill-paragraphs';
import { replaceParagraphText } from '@/pptx/jszip/text/replace-paragraph-text';

const zip = await JSZip.loadAsync(await readFile('templates/daa.pptx'));
const { objects, slides } = await findNamedObjects(zip, ['TEXT_ME']);
const shape = objects.get('TEXT_ME')!.element;
fillParagraphs(shape, [
  'Prepared for {{customer}}',
  'Results for {{customer}}',
]);
replaceParagraphText(shape, '{{customer}}', 'Example Company');
for (const [path, document] of slides) writeXml(zip, path, document);

await mkdir('output/jszip', { recursive: true });
await writeFile(
  'output/jszip/paragraphs.pptx',
  await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }),
);
