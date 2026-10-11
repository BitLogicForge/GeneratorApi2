import { hasControlCharacters } from '../../validation/control-characters.js';
import { AppError } from '../../errors.js';
import type { DataApiQuery } from '../data-api-client.js';

/** Resolves and encodes a request within the configured API prefix. */
export function buildDataApiUrl(
  baseUrl: string,
  path: string,
  query: DataApiQuery,
): URL {
  if (
    !path ||
    path.startsWith('//') ||
    /^[a-z][a-z0-9+.-]*:/i.test(path) ||
    /[\\?#]/.test(path) ||
    hasControlCharacters(path)
  )
    throw new AppError(
      400,
      'INVALID_DATA_API_PATH',
      'Use a relative data API path',
    );
  const base = new URL(baseUrl);
  base.pathname = `${base.pathname.replace(/\/$/, '')}/`;
  const url = new URL(path.replace(/^\//, ''), base);
  if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname))
    throw new AppError(
      400,
      'INVALID_DATA_API_PATH',
      'Path must stay within the configured data API',
    );
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) continue;
    if (typeof value === 'number' && !Number.isFinite(value))
      throw new AppError(
        400,
        'INVALID_DATA_API_QUERY',
        'Numeric query values must be finite',
      );
    url.searchParams.set(key, String(value));
  }
  return url;
}
