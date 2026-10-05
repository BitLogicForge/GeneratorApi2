import { z } from 'zod';
export function loadConfig(env: NodeJS.ProcessEnv = process.env) {
  const c = z.object({
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    WEBAPP_BASE_URL: z.url().default('http://localhost:3001'),
    PDF_CONCURRENCY: z.coerce.number().int().min(1).max(10).default(2),
    RENDER_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120000).default(30000),
  }).parse(env);
  const base = new URL(c.WEBAPP_BASE_URL);
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password) throw new Error('WEBAPP_BASE_URL must be HTTP(S) without credentials');
  return { port: c.PORT, baseUrl: base.origin, concurrency: c.PDF_CONCURRENCY, timeout: c.RENDER_TIMEOUT_MS };
}

export type Config = ReturnType<typeof loadConfig>;
