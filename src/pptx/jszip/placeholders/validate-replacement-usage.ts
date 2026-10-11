import { AppError } from '@/errors';

import type { ReplacementUsage } from './types.ts';

export function validateReplacementUsage(
  replacements: Record<string, string>,
  { used, missing }: ReplacementUsage,
) {
  if (missing.size)
    throw new AppError(
      400,
      'MISSING_REPLACEMENTS',
      `Missing replacements: ${[...missing].join(', ')}`,
    );
  const unused = Object.keys(replacements).filter((key) => !used.has(key));
  if (unused.length)
    throw new AppError(
      400,
      'UNKNOWN_PLACEHOLDERS',
      `Template does not contain: ${unused.join(', ')}`,
    );
}
