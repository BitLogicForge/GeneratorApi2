import { readFile, mkdir, writeFile } from 'node:fs/promises';
import JSZip from 'jszip';
import { listSlides, duplicateSlide } from '@/pptx/jszip/slides';

const zip = await JSZip.loadAsync(await readFile('templates/daa.pptx'));
const [source] = await listSlides(zip);
await duplicateSlide(zip, source);

await mkdir('output/jszip', { recursive: true });
await writeFile(
  'output/jszip/duplicate-slide.pptx',
  await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }),
);
