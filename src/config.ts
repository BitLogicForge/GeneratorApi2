import { z } from 'zod';
import { pdfRoutePatternSchema } from './pdf-route.js';
export function loadConfig(env: NodeJS.ProcessEnv = process.env) {
  const c = z.object({
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    WEBAPP_BASE_URL: z.url().default('http://localhost:3001'),
    PDF_ROUTE_PATTERN: pdfRoutePatternSchema.default('/documents/{id}'),
    PDF_CONCURRENCY: z.coerce.number().int().min(1).max(10).default(2),
    PPTX_CONCURRENCY: z.coerce.number().int().min(1).max(20).default(4),
    QUEUE_MAX_PENDING: z.coerce.number().int().min(0).max(2000).default(200),
    QUEUE_WAIT_TIMEOUT_MS: z.coerce.number().int().min(1000).max(180000).default(120000),
    RENDER_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120000).default(30000),
  }).parse(env);
  const base = new URL(c.WEBAPP_BASE_URL);
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password) throw new Error('WEBAPP_BASE_URL must be HTTP(S) without credentials');
  return { port: c.PORT, pdfRoutePattern: c.PDF_ROUTE_PATTERN, baseUrl: base.origin, concurrency: c.PDF_CONCURRENCY, timeout: c.RENDER_TIMEOUT_MS, presentationConcurrency: c.PPTX_CONCURRENCY, maxPending: c.QUEUE_MAX_PENDING, waitTimeoutMs: c.QUEUE_WAIT_TIMEOUT_MS };
}

export type Config = ReturnType<typeof loadConfig>;
