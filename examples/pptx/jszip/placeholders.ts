import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import JSZip from 'jszip';
import pptxgen from 'pptxgenjs';

import { replacePlaceholders } from '@/pptx/jszip/placeholders';
import { pptxRenderSchema } from '@/services/jszip/contracts';

/** Ensures the business template with {{key}} tokens exists before reading it. */
async function ensureTemplate(templatePath: string) {
  if (existsSync(templatePath)) return;
  const deck = new pptxgen();
  deck.layout = 'LAYOUT_WIDE';
  const slide = deck.addSlide();
  slide.background = { color: '0F172A' };
  slide.addText('{{title}}', {
    x: 0.8,
    y: 1.6,
    w: 11.7,
    h: 1.5,
    fontSize: 40,
    bold: true,
    color: 'FFFFFF',
    fit: 'shrink',
  });
  slide.addText('{{subtitle}}', {
    x: 0.8,
    y: 3.4,
    w: 11.7,
    h: 1,
    fontSize: 22,
    color: 'CBD5E1',
    fit: 'shrink',
  });
  slide.addText('Prepared for {{customer}}', {
    x: 0.8,
    y: 6.3,
    w: 11.7,
    h: 0.4,
    fontSize: 14,
    color: '60A5FA',
  });
  slide.addNotes('Presenting to {{customer}}');
  await deck.writeFile({ fileName: templatePath });
}

const templatePath = fileURLToPath(
  new URL('../../../templates/business.pptx', import.meta.url),
);
await ensureTemplate(templatePath);

const payloadPath = fileURLToPath(new URL('../template.json', import.meta.url));
const rawPayload = JSON.parse(await readFile(payloadPath, 'utf8'));
const input = pptxRenderSchema.parse(rawPayload);

const zip = await JSZip.loadAsync(await readFile(templatePath));
await replacePlaceholders(zip, input.replacements);

const outputDir = new URL('../../../output/jszip/', import.meta.url);
await mkdir(outputDir, { recursive: true });
const outputFile = new URL('placeholders.pptx', outputDir);
await writeFile(
  outputFile,
  await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }),
);

console.log(
  `Saved placeholder-filled presentation to ${fileURLToPath(outputFile)}`,
);
