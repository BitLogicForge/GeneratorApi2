import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { loadConfig } from '../../../src/config.ts';
import { DataApiClient } from '../../../src/services/data-api-client.ts';
import { fetchReportDataBatch } from './collect.ts';

const config = loadConfig();
const mode = z.enum(['dict', 'list']).parse(process.argv[2] ?? 'dict');
const language = process.argv[3] ?? config.defaultLanguage;
const year = Number(process.argv[4] ?? 2026);
const api = new DataApiClient(config.dataApi);
const data = await fetchReportDataBatch(api, { language, year }, mode);
const directory = new URL('../../../output/data-api/', import.meta.url);
await mkdir(directory, { recursive: true });
const file = new URL(`reports-${mode}.json`, directory);
await writeFile(file, JSON.stringify(data, null, 2) + '\n');
console.log(`Saved collected reports to ${fileURLToPath(file)}`);
