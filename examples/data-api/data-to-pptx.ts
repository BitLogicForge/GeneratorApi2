import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import JSZip from 'jszip';

import { loadConfig } from '@/config';
import { fillCategoryChart } from '@/pptx/jszip/charts';
import { findNamedObjects } from '@/pptx/jszip/objects';
import { writeXml } from '@/pptx/jszip/package/write-xml';
import { fillTable } from '@/pptx/jszip/tables/fill';
import { fillTextShape } from '@/pptx/jszip/text/fill-shape';
import { DataApiClient } from '@/services/data-api-client';
import { documentIdSchema } from '@/validation/schema';

const config = loadConfig();
const id = documentIdSchema.parse(process.argv[2] ?? 'id2222');
const language = process.argv[3] ?? config.defaultLanguage;
const year = Number(process.argv[4] ?? 2026);

// Fetch data from upstream Data API.
const api = new DataApiClient(config.dataApi);
const data = await api.get('report', { id }, { language, year });

// Populate templates/daa.pptx using the fetched data.
const templatePath = fileURLToPath(
  new URL('../../templates/daa.pptx', import.meta.url),
);
const zip = await JSZip.loadAsync(await readFile(templatePath));
const { objects, slides } = await findNamedObjects(zip, [
  'TAB100',
  'GGO',
  'TEXT_ME',
]);

fillTextShape(
  objects.get('TEXT_ME').element,
  `Report ${data.id} - ${data.language.toUpperCase()} ${data.year}`,
);

fillTable(objects.get('TAB100').element, data.tableData, {
  startRow: 1,
});

await fillCategoryChart(zip, objects.get('GGO'), data.chartData, {
  categories: data.categories,
});

for (const [path, document] of slides) writeXml(zip, path, document);

const outputDir = new URL('../../output/data-api/', import.meta.url);
await mkdir(outputDir, { recursive: true });
const outputFile = new URL(`${id}-report.pptx`, outputDir);
await writeFile(
  outputFile,
  await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }),
);

console.log(
  `Generated presentation from Data API: ${fileURLToPath(outputFile)}`,
);
