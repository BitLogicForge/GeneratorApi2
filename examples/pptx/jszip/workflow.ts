import { mkdir, readFile, writeFile } from 'node:fs/promises';
import JSZip from 'jszip';

import { fillCategoryChart } from '@/pptx/jszip/charts';
import { findNamedObjects } from '@/pptx/jszip/objects';
import { writeXml } from '@/pptx/jszip/package/write-xml';
import { duplicateSlide } from '@/pptx/jszip/slides/duplicate';
import { listSlides } from '@/pptx/jszip/slides/list';
import { removeSlide } from '@/pptx/jszip/slides/remove';
import { fillTable } from '@/pptx/jszip/tables/fill';
import { fillParagraphs } from '@/pptx/jszip/text/fill-paragraphs';
import { replaceParagraphText } from '@/pptx/jszip/text/replace-paragraph-text';

const zip = await JSZip.loadAsync(await readFile('templates/daa.pptx'));
const [source] = await listSlides(zip);
const copy = await duplicateSlide(zip, source);
const { objects, slides } = await findNamedObjects(zip, ['GGO', 'TEXT_ME', 'TAB100']);
const copyObjects = objects.inSlide(copy);

await fillCategoryChart(
  zip,
  copyObjects.get('GGO'),
  [
    [10, 20, 30],
    [40, 50, 60],
  ],
  { categories: ['January', 'February'] },
);
fillParagraphs(copyObjects.get('TEXT_ME').element, [
  'Results for {{customer}}',
  'Prepared for {{customer}}',
]);
replaceParagraphText(copyObjects.get('TEXT_ME').element, '{{customer}}', 'Example Company');
fillTable(
  copyObjects.get('TAB100').element,
  [
    [1, 2, 3, 4],
    [5, 6, 7, 8],
  ],
  { startRow: 1, resizeRows: true },
);
for (const [path, document] of slides) writeXml(zip, path, document);

// Keep just the filled copy. Omit this call to keep the original too.
await removeSlide(zip, source);
await mkdir('output', { recursive: true });
await writeFile(
  'output/filled-template.pptx',
  await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }),
);
