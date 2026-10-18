import { mkdir, readFile, writeFile } from 'node:fs/promises';

import JSZip from 'jszip';

import { findNamedObjects } from '@/pptx/jszip/objects';
import { writeXml } from '@/pptx/jszip/package/write-xml';
import { fillTable } from '@/pptx/jszip/tables/fill';

const zip = await JSZip.loadAsync(await readFile('templates/daa.pptx'));
const { objects, slides } = await findNamedObjects(zip, ['TAB100']);

// Demonstrates 2D table resizing: growing to 5 columns and shrinking to 2 data rows,
// while preserving the original header row (startRow: 1).
fillTable(
  objects.get('TAB100').element,
  [
    [10, 20, 30, 40, 50],
    [60, 70, 80, 90, 100],
  ],
  {
    startRow: 1,
    resizeRows: true,
    resizeColumns: true,
    cellColors: [
      ['FF0000', '008800', '0000FF', undefined, 'FF8800'],
      ['880088', 'FF8800', '008888', undefined, '000088'],
    ],
  },
);
for (const [path, document] of slides) writeXml(zip, path, document);

await mkdir('output/jszip', { recursive: true });
await writeFile(
  'output/jszip/table.pptx',
  await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }),
);

console.log('Saved 2D resized table to output/jszip/table.pptx');
