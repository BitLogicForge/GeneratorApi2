import { readFile, mkdir, writeFile } from 'node:fs/promises';
import JSZip from 'jszip';
import { listSlides, removeSlide } from '@/pptx/jszip/slides';

// Run the duplicate-slide example first to create a deck with two slides.
const zip = await JSZip.loadAsync(
  await readFile('output/jszip/duplicate-slide.pptx'),
);
const [source] = await listSlides(zip);
await removeSlide(zip, source);

await mkdir('output/jszip', { recursive: true });
await writeFile(
  'output/jszip/remove-slide.pptx',
  await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }),
);
