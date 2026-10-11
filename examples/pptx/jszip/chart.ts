import { mkdir, readFile, writeFile } from 'node:fs/promises';

import JSZip from 'jszip';

import { fillCategoryChart } from '@/pptx/jszip/charts';
import { findNamedObjects } from '@/pptx/jszip/objects';

const zip = await JSZip.loadAsync(await readFile('templates/daa.pptx'));
const { objects } = await findNamedObjects(zip, ['GGO']);
await fillCategoryChart(
  zip,
  objects.get('GGO')!,
  [
    [10, 20, 30],
    [40, 50, 60],
  ],
  { categories: ['January', 'February'] },
);

await mkdir('output/jszip', { recursive: true });
await writeFile(
  'output/jszip/chart.pptx',
  await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }),
);
