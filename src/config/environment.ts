import { z } from 'zod';

import { dataApiCacheDefaults } from './defaults.ts';

/** Validates environment values once, before any services start. */
export function readEnvironment(env: NodeJS.ProcessEnv) {
  const c = z
    .object({
      API_HOST: z.string().trim().min(1).default('0.0.0.0'),
      API_PORT: z.coerce.number().int().min(1).max(65535).default(3000),
      WEBAPP_BASE_URL: z.url().default('http://localhost:3001'),
      DATA_API_BASE_URL: z.preprocess(
        (value) => (value === '' ? undefined : value),
        z.url().optional(),
      ),
      DATA_API_TOKEN: z.preprocess(
        (value) => (value === '' ? undefined : value),
        z.string().optional(),
      ),
      DATA_API_TIMEOUT_MS: z.coerce
        .number()
        .int()
        .min(1)
        .max(120000)
        .default(10000),
      DATA_API_CACHE_TTL_MS: z.coerce
        .number()
        .int()
        .min(0)
        .max(3600000)
        .default(dataApiCacheDefaults.ttlMs),
      DATA_API_CACHE_MAX_ENTRIES: z.coerce
        .number()
        .int()
        .min(1)
        .max(10000)
        .default(dataApiCacheDefaults.maxEntries),
      DATA_API_CACHE_MAX_BYTES: z.coerce
        .number()
        .int()
        .min(1)
        .max(268435456)
        .default(dataApiCacheDefaults.maxBytes),
      PDF_CONCURRENCY: z.coerce.number().int().min(1).max(10).default(2),
      PPTX_CONCURRENCY: z.coerce.number().int().min(1).max(20).default(4),
      QUEUE_MAX_PENDING: z.coerce.number().int().min(0).max(2000).default(200),
      QUEUE_WAIT_TIMEOUT_MS: z.coerce
        .number()
        .int()
        .min(1000)
        .max(180000)
        .default(120000),
      RENDER_TIMEOUT_MS: z.coerce
        .number()
        .int()
        .min(1000)
        .max(120000)
        .default(30000),
    })
    .parse(env);
  const base = new URL(c.WEBAPP_BASE_URL);
  if (
    !['http:', 'https:'].includes(base.protocol) ||
    base.username ||
    base.password
  )
    throw new Error('WEBAPP_BASE_URL must be HTTP(S) without credentials');
  if (c.DATA_API_BASE_URL) {
    const url = new URL(c.DATA_API_BASE_URL);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      throw new Error(
        'DATA_API_BASE_URL must be HTTP(S) without credentials, query, or fragment',
      );
  }
  return { ...c, baseUrl: base.origin };
}
