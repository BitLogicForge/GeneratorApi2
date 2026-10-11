import { z } from 'zod';

import { pdfRoutePatternSchema } from '@/routes/api/exports/pdf/webapp-route';

import { dataApiEndpoints } from './data-api/endpoints.ts';

// Shared defaults for environment configuration and directly constructed clients.
export const dataApiCacheDefaults = {
  ttlMs: 30000,
  maxEntries: 500,
  maxBytes: 16 * 1024 * 1024,
};

// Application behavior: edit these values here, then rebuild the deployment package.
const documentSettings = {
  defaultLanguage: 'en',
  pdfRoutePattern: '/documents/{id}',
};

// PDF appearance: margins are in millimetres; scale accepts 0.1–2.
// These defaults apply to every PDF endpoint. Rebuild after editing.
const pdfPrintSettings = {
  format: 'A4',
  landscape: false,
  margin: { top: 12, right: 12, bottom: 12, left: 12 },
  scale: 1,
  printBackground: true,
  printImages: true,
  media: 'print',
  preferCSSPageSize: false,
  displayHeaderFooter: false,
  // Chromium supports date, title, url, pageNumber and totalPages classes.
  headerTemplate: '<span></span>',
  footerTemplate: '<span></span>',
  hideSelectors: [] as string[],
  // Applied after the webapp styles; use @media print for print-only rules.
  css: '',
};

const pdfPrintSettingsSchema = z
  .object({
    format: z.enum([
      'A3',
      'A4',
      'A5',
      'A6',
      'Letter',
      'Legal',
      'Tabloid',
      'Ledger',
    ]),
    landscape: z.boolean(),
    margin: z
      .object({
        top: z.number().min(0).max(200),
        right: z.number().min(0).max(200),
        bottom: z.number().min(0).max(200),
        left: z.number().min(0).max(200),
      })
      .strict(),
    scale: z.number().min(0.1).max(2),
    printBackground: z.boolean(),
    printImages: z.boolean(),
    media: z.enum(['print', 'screen']),
    preferCSSPageSize: z.boolean(),
    displayHeaderFooter: z.boolean(),
    headerTemplate: z.string().max(20000),
    footerTemplate: z.string().max(20000),
    hideSelectors: z.array(z.string().trim().min(1).max(300)).max(100),
    css: z.string().max(50000),
  })
  .strict();

export function resolvePdfPrintSettings(settings = pdfPrintSettings) {
  return pdfPrintSettingsSchema.parse(settings);
}

/** Validates settings before startup and exposes the webapp origin as the PDF navigation boundary. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env) {
  const documents = z
    .object({
      defaultLanguage: z.string().trim().min(1).max(100),
      pdfRoutePattern: pdfRoutePatternSchema,
    })
    .parse(documentSettings);
  const c = z
    .object({
      HOST: z.string().trim().min(1).default('0.0.0.0'),
      PORT: z.coerce.number().int().min(1).max(65535).default(3000),
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
    defaultLanguage: documents.defaultLanguage,
    port: c.PORT,
    pdfRoutePattern: documents.pdfRoutePattern,
    baseUrl: base.origin,
    concurrency: c.PDF_CONCURRENCY,
    timeout: c.RENDER_TIMEOUT_MS,
    presentationConcurrency: c.PPTX_CONCURRENCY,
    maxPending: c.QUEUE_MAX_PENDING,
    waitTimeoutMs: c.QUEUE_WAIT_TIMEOUT_MS,
  };
}

export type Config = ReturnType<typeof loadConfig>;
