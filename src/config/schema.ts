import { z } from 'zod';

import { HTTP_PROTOCOLS } from '@/services/pdf/constants';

import { dataApiCacheDefaults, queueDefaults } from './defaults.ts';

const webappBaseUrlSchema = z.url().refine((value) => {
  try {
    const base = new URL(value);
    return (
      (HTTP_PROTOCOLS as readonly string[]).includes(base.protocol) &&
      !base.username &&
      !base.password
    );
  } catch {
    return false;
  }
}, 'WEBAPP_BASE_URL must be HTTP(S) without credentials');

const dataApiBaseUrlSchema = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z
    .url()
    .refine((value) => {
      try {
        const url = new URL(value);
        return (
          (HTTP_PROTOCOLS as readonly string[]).includes(url.protocol) &&
          !url.username &&
          !url.password &&
          !url.search &&
          !url.hash
        );
      } catch {
        return false;
      }
    }, 'DATA_API_BASE_URL must be HTTP(S) without credentials, query, or fragment')
    .optional(),
);

function booleanEnv(defaultValue: boolean) {
  return z.preprocess((value) => {
    if (value === undefined || value === '') return defaultValue;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (normalized === 'true' || normalized === '1') return true;
      if (normalized === 'false' || normalized === '0') return false;
    }
    return value;
  }, z.boolean());
}

export const environmentSchema = z
  .object({
    API_HOST: z.string().trim().min(1).default('0.0.0.0'),
    API_PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    WEBAPP_BASE_URL: webappBaseUrlSchema.default('http://localhost:3001'),
    DATA_API_BASE_URL: dataApiBaseUrlSchema,
    DATA_API_TOKEN: z.preprocess(
      (value) => (value === '' ? undefined : value),
      z.string().optional(),
    ),
    DATA_API_TIMEOUT_MS: z.coerce.number().int().min(1).max(120000).default(10000),
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
    PDF_CONCURRENCY: z.coerce.number().int().min(1).max(10).default(queueDefaults.concurrency),
    PPTX_CONCURRENCY: z.coerce
      .number()
      .int()
      .min(1)
      .max(20)
      .default(queueDefaults.presentationConcurrency),
    QUEUE_MAX_PENDING: z.coerce.number().int().min(0).max(2000).default(queueDefaults.maxPending),
    QUEUE_WAIT_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .min(1000)
      .max(180000)
      .default(queueDefaults.waitTimeoutMs),
    RENDER_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120000).default(30000),
    PDF_ALLOW_HTTP_404: booleanEnv(false),
    PDF_PERMIT_HTTP_404: z.preprocess(
      (value) => (value === '' ? undefined : value),
      z.string().optional(),
    ),
    LOG_IGNORE_UNMATCHED: booleanEnv(false),
    LOG_SUPPRESS_UNMATCHED: z.preprocess(
      (value) => (value === '' ? undefined : value),
      z.string().optional(),
    ),
    LOG_EXCLUDE_ROUTES: z.preprocess((value) => {
      if (typeof value !== 'string' || value.trim() === '') return [];
      return value
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    }, z.array(z.string()).default([])),
    PDF_LOG_REQUESTS: booleanEnv(true),
    LOG_VERBOSE: booleanEnv(false),
  })
  .transform((c) => {
    const permit404Alias =
      c.PDF_PERMIT_HTTP_404 !== undefined
        ? ['true', '1'].includes(c.PDF_PERMIT_HTTP_404.trim().toLowerCase())
        : false;
    const suppressUnmatchedAlias =
      c.LOG_SUPPRESS_UNMATCHED !== undefined
        ? ['true', '1'].includes(c.LOG_SUPPRESS_UNMATCHED.trim().toLowerCase())
        : false;
    return {
      ...c,
      baseUrl: new URL(c.WEBAPP_BASE_URL).origin,
      allowHttp404: c.PDF_ALLOW_HTTP_404 || permit404Alias,
      logIgnoreUnmatched: c.LOG_IGNORE_UNMATCHED || suppressUnmatchedAlias,
      logExcludeRoutes: c.LOG_EXCLUDE_ROUTES,
      pdfLogRequests: c.PDF_LOG_REQUESTS || c.LOG_VERBOSE,
      logVerbose: c.LOG_VERBOSE,
    };
  });

export type Environment = z.output<typeof environmentSchema>;
