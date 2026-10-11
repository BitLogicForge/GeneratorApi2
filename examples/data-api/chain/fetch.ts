import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { loadConfig } from '@/config';
import { DataApiClient } from '@/services/data-api-client';
import { documentIdSchema } from '@/validation/document-id';

import { fetchReportDataChain } from './collect.ts';

const config = loadConfig();
const id = documentIdSchema.parse(process.argv[2] ?? 'id2222');
const language = process.argv[3] ?? config.defaultLanguage;
const year = Number(process.argv[4] ?? 2026);
const api = new DataApiClient(config.dataApi);
const data = await fetchReportDataChain(api, id, { language, year });
const directory = new URL('../../../output/data-api/', import.meta.url);
await mkdir(directory, { recursive: true });
const file = new URL(`${id}-chain.json`, directory);
await writeFile(file, JSON.stringify(data, null, 2) + '\n');
console.log(
  `Fetched report ${data.report.id} for ${data.customer.name}; saved ${fileURLToPath(file)}`,
);
