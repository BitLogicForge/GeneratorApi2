import { z } from 'zod';

import { hasControlCharacters } from '@/utils/control-characters';

export const dataApiPathSchema = z
  .string()
  .min(1)
  .refine(
    (path) =>
      !path.startsWith('//') &&
      !/^[a-z][a-z0-9+.-]*:/i.test(path) &&
      !/[\\?#]/.test(path) &&
      !hasControlCharacters(path),
    'Use a relative data API path',
  );

// Zod numbers reject NaN and infinities by default.
export const dataApiQuerySchema = z.record(
  z.string(),
  z.union([z.string(), z.number(), z.boolean()]).optional(),
);

/** Checks a resolved URL against the configured API origin and directory prefix. */
export function createDataApiUrlSchema(base: URL) {
  return z
    .instanceof(URL)
    .refine(
      (url) =>
        url.origin === base.origin && url.pathname.startsWith(base.pathname),
      'Path must stay within the configured data API',
    );
}
