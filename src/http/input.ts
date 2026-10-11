import { AppError } from '@/errors';

import type { Request } from 'express';

// Shared by query decoding and OpenAPI parameter generation.
export const jsonQueryFields: readonly string[] = [
  'query',
  'slides',
  'replacements',
  'landscape',
];

/** Gives GET/HEAD exports the same structured input as POST by decoding JSON query fields. */
export function generationInput(req: Request) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return req.body;
  const input: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(req.query)) {
    if (typeof value !== 'string')
      throw new AppError(
        400,
        'INVALID_QUERY_PARAMETER',
        `Supply a single value for: ${key}`,
      );
    if (jsonQueryFields.includes(key)) {
      try {
        input[key] = JSON.parse(value);
      } catch {
        throw new AppError(
          400,
          'INVALID_QUERY_PARAMETER',
          `Query parameter must contain valid JSON: ${key}`,
        );
      }
    } else input[key] = value;
  }
  return input;
}
