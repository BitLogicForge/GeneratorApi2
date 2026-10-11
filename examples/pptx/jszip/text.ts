import { mkdir, readFile, writeFile } from 'node:fs/promises';

import JSZip from 'jszip';

import { findNamedObjects } from '@/pptx/jszip/objects';
import { writeXml } from '@/pptx/jszip/package/write-xml';
import { fillTextShape } from '@/pptx/jszip/text/fill-shape';

const zip = await JSZip.loadAsync(await readFile('templates/daa.pptx'));
const { objects, slides } = await findNamedObjects(zip, ['TEXT_ME']);
fillTextShape(objects.get('TEXT_ME')!.element, 'Quarterly results');
for (const [path, document] of slides) writeXml(zip, path, document);

await mkdir('output/jszip', { recursive: true });
await writeFile(
  'output/jszip/text.pptx',
  await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }),
);
