import { dataApiEndpoints } from '@/data-api/endpoints';
import { resolvePdfPrintSettings } from '@/services/pdf/contracts';

import { readEnvironment } from './environment.ts';

export function loadConfig(env: NodeJS.ProcessEnv = process.env) {
  const c = readEnvironment(env);
  return {
    pdfPrint: resolvePdfPrintSettings(),
    host: c.HOST,
    dataApi: {
      endpoints: dataApiEndpoints,
      baseUrl: c.DATA_API_BASE_URL,
      token: c.DATA_API_TOKEN,
      timeoutMs: c.DATA_API_TIMEOUT_MS,
      cache: {
        ttlMs: c.DATA_API_CACHE_TTL_MS,
        maxEntries: c.DATA_API_CACHE_MAX_ENTRIES,
        maxBytes: c.DATA_API_CACHE_MAX_BYTES,
      },
    },
    defaultLanguage: 'en',
    port: c.PORT,
    baseUrl: c.baseUrl,
    concurrency: c.PDF_CONCURRENCY,
    timeout: c.RENDER_TIMEOUT_MS,
    presentationConcurrency: c.PPTX_CONCURRENCY,
    maxPending: c.QUEUE_MAX_PENDING,
    waitTimeoutMs: c.QUEUE_WAIT_TIMEOUT_MS,
  };
}

export type Config = ReturnType<typeof loadConfig>;
