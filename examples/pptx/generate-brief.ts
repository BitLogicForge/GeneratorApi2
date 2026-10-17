import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { briefInputSchema } from '@/services/pptxgenjs/contracts';
import { PowerPointGenerationService } from '@/services/pptxgenjs/power-point-generation-service';

const payloadPath = fileURLToPath(new URL('./generated.json', import.meta.url));
const rawPayload = JSON.parse(await readFile(payloadPath, 'utf8'));
const input = briefInputSchema.parse(rawPayload);

const service = new PowerPointGenerationService();
const buffer = await service.generate('brief', input);

const outputDir = new URL('../../output/pptx/', import.meta.url);
await mkdir(outputDir, { recursive: true });
const outputFile = new URL(`${input.filename}.pptx`, outputDir);
await writeFile(outputFile, buffer);

console.log(
  `Generated presentation with ${input.slides.length} slides: ${fileURLToPath(outputFile)}`,
);
