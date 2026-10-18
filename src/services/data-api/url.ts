import { AppError } from '@/errors';
import { buildUrl } from '@/url';

import {
  createDataApiUrlSchema,
  dataApiPathSchema,
  dataApiQuerySchema,
} from './schema.ts';

import type { DataApiQuery } from '@/services/data-api-client';

/** Resolves and encodes a request within the configured API prefix. */
export function buildDataApiUrl(
  baseUrl: string,
  path: string,
  query: DataApiQuery,
): URL {
  if (!dataApiPathSchema.safeParse(path).success)
    throw new AppError(
      400,
      'INVALID_DATA_API_PATH',
      'Use a relative data API path',
    );
  const base = new URL(baseUrl);
  base.pathname = `${base.pathname.replace(/\/$/, '')}/`;
  const url = buildUrl(base.href, path.replace(/^\//, ''), { query });
  if (!createDataApiUrlSchema(base).safeParse(url).success)
    throw new AppError(
      400,
      'INVALID_DATA_API_PATH',
      'Path must stay within the configured data API',
    );
  if (!dataApiQuerySchema.safeParse(query).success)
    throw new AppError(
      400,
      'INVALID_DATA_API_QUERY',
      'Numeric query values must be finite',
    );
  return url;
}
