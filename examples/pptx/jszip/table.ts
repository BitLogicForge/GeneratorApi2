import { mkdir, readFile, writeFile } from 'node:fs/promises';

import JSZip from 'jszip';

import { findNamedObjects } from '@/pptx/jszip/objects';
import { writeXml } from '@/pptx/jszip/package/write-xml';
import { fillTable } from '@/pptx/jszip/tables/fill';

const zip = await JSZip.loadAsync(await readFile('templates/daa.pptx'));
const { objects, slides } = await findNamedObjects(zip, ['TAB100']);
fillTable(
  objects.get('TAB100')!.element,
  [
    [1, 2, 3, 4],
    [5, 6, 7, 8],
  ],
  { startRow: 1, resizeRows: true },
);
for (const [path, document] of slides) writeXml(zip, path, document);

await mkdir('output/jszip', { recursive: true });
await writeFile(
  'output/jszip/table.pptx',
  await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }),
);
