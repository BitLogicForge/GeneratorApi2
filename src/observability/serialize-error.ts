import { ZodError } from 'zod';

import { AppError } from '@/errors';

const MAX_DEPTH = 5;

/** Converts any thrown value, its cause chain, and aggregated errors into plain JSON for logs. */
export function serializeError(error: unknown, depth = 0): unknown {
  if (!(error instanceof Error)) return { thrown: error };
  if (depth >= MAX_DEPTH) return { name: error.name, message: error.message, truncated: true };
  const extra = error as Error & { code?: unknown; errno?: unknown; syscall?: unknown };
  return {
    name: error.name,
    message: error.message,
    ...(error instanceof AppError && {
      status: error.status,
      code: error.code,
      ...(error.details && { details: error.details }),
    }),
    // Node system errors (ECONNREFUSED, ENOENT, ...) carry these fields.
    ...(!(error instanceof AppError) && extra.code !== undefined && { code: extra.code }),
    ...(extra.errno !== undefined && { errno: extra.errno }),
    ...(extra.syscall !== undefined && { syscall: extra.syscall }),
    ...(error instanceof ZodError && {
      issues: error.issues.map(({ path, message, code }) => ({ path, message, code })),
    }),
    stack: error.stack,
    ...(error.cause !== undefined && { cause: serializeError(error.cause, depth + 1) }),
    ...(error instanceof AggregateError && {
      errors: error.errors.map((item: unknown) => serializeError(item, depth + 1)),
    }),
  };
}
