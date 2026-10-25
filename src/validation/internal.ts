import { ErrorCode } from '@/constants';
import { AppError } from '@/errors';

import type { z } from 'zod';

/**
 * Validates server-produced data (prepared report input, merged settings). A failure is a
 * programming or configuration error, so it becomes a logged 500 rather than a client 400.
 */
export function parseInternal<Schema extends z.ZodType>(
  schema: Schema,
  value: unknown,
  label: string,
): z.output<Schema> {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  throw new AppError(500, ErrorCode.InternalError, `${label} failed internal validation`, {
    details: {
      label,
      issues: result.error.issues.map(({ path, message, code }) => ({ path, message, code })),
    },
  });
}
