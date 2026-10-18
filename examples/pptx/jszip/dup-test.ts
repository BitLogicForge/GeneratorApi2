import { mkdir, readFile, writeFile } from 'node:fs/promises';
import JSZip from 'jszip';

import { duplicateSlide } from '@/pptx/jszip/slides/duplicate';
import { listSlides } from '@/pptx/jszip/slides/list';

const zip = await JSZip.loadAsync(await readFile('templates/template_3.pptx'));
const copy = await duplicateSlide(zip, 2);

await mkdir('output', { recursive: true });
await writeFile(
  'output/dup_test.pptx',
  await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }),
);

console.log(`Duplicated slide 2 to ${copy}`);
console.log('Slides in presentation:', await listSlides(zip));
console.log('Saved to output/dup_test.pptx');
