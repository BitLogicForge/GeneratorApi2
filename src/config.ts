import { z } from 'zod';
import { pdfRoutePatternSchema } from './pdf-route.js';

// Application behavior: edit these values here, then rebuild the deployment package.
const documentSettings = {
  defaultLanguage: 'en',
  pdfRoutePattern: '/documents/{id}',
};

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
    host: c.HOST,
    dataApi: {
      baseUrl: c.DATA_API_BASE_URL,
      token: c.DATA_API_TOKEN,
      timeoutMs: c.DATA_API_TIMEOUT_MS,
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
