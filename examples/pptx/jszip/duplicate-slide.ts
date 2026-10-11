import { readFile, mkdir, writeFile } from 'node:fs/promises';
import JSZip from 'jszip';
import { listSlides } from '@/pptx/jszip/slides/list';
import { duplicateSlide } from '@/pptx/jszip/slides/duplicate';

const zip = await JSZip.loadAsync(await readFile('templates/daa.pptx'));
const [source] = await listSlides(zip);
await duplicateSlide(zip, source);

await mkdir('output/jszip', { recursive: true });
await writeFile(
  'output/jszip/duplicate-slide.pptx',
  await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }),
);
