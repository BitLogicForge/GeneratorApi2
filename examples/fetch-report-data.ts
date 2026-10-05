import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../src/config.js';
import { DataApiClient } from '../src/services/data-api-client.js';
import type { ReportData } from './report-data.js';

const config = loadConfig();
const id = process.argv[2] ?? 'id2222';
const language = process.argv[3] ?? config.defaultLanguage;
const year = Number(process.argv[4] ?? 2026);
const api = new DataApiClient(config.dataApi);
const data = await api.get<ReportData>(`/reports/${encodeURIComponent(id)}`, {
  language,
  year,
});
const directory = new URL('../output/data-api/', import.meta.url);
await mkdir(directory, { recursive: true });
const file = new URL(`${id}.json`, directory);
await writeFile(file, JSON.stringify(data, null, 2) + '\n');
console.log(
  `Fetched ${data.id}, language=${data.language}, year=${data.year}; saved ${fileURLToPath(file)}`,
);
// In a template service, these values can feed fillTable, fillLineChart, and fillTextShape.
