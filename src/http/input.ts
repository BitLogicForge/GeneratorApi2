import type { Request } from 'express';
import { AppError } from '../errors.js';

/** Gives GET exports the same structured input as POST by decoding JSON query fields. */
export function generationInput(req: Request) {
  if (req.method !== 'GET') return req.body;
  const input: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(req.query)) {
    if (typeof value !== 'string')
      throw new AppError(
        400,
        'INVALID_QUERY_PARAMETER',
        `Supply a single value for: ${key}`,
      );
    if (['query', 'slides', 'replacements', 'landscape'].includes(key)) {
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
