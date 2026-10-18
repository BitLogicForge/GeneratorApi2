import { ErrorCode, ErrorMessage } from '@/constants';
import { AppError } from '@/errors';
import { buildUrl } from '@/utils/url';

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
      ErrorCode.InvalidDataApiPath,
      ErrorMessage.InvalidDataApiRelativePath,
    );
  const base = new URL(baseUrl);
  base.pathname = `${base.pathname.replace(/\/$/, '')}/`;
  const url = buildUrl(base.href, path.replace(/^\//, ''), { query });
  if (!createDataApiUrlSchema(base).safeParse(url).success)
    throw new AppError(
      400,
      ErrorCode.InvalidDataApiPath,
      ErrorMessage.InvalidDataApiPrefixPath,
    );
  if (!dataApiQuerySchema.safeParse(query).success)
    throw new AppError(
      400,
      ErrorCode.InvalidDataApiQuery,
      ErrorMessage.InvalidDataApiQuery,
    );
  return url;
}
