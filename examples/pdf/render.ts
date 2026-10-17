import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { loadConfig } from '@/config';
import { pdfRenderSchema } from '@/services/pdf/contracts';
import { WebPagePdfService } from '@/services/pdf/web-page-pdf';

const config = loadConfig();
const pdfService = new WebPagePdfService(config);

const configPath = process.argv[2] ?? 'examples/pdf/quarterly-portrait.json';
const rawConfig = JSON.parse(await readFile(configPath, 'utf8'));
const input = pdfRenderSchema.parse(rawConfig);

try {
  const buffer = await pdfService.generate(input);
  const outputDir = new URL('../../output/pdf/', import.meta.url);
  await mkdir(outputDir, { recursive: true });
  const outputFile = new URL(`${input.filename}.pdf`, outputDir);
  await writeFile(outputFile, buffer);
  console.log(
    `Rendered PDF from ${configPath} to ${fileURLToPath(outputFile)}`,
  );
} finally {
  await pdfService.close();
}
