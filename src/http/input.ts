import { ErrorCode } from '@/constants';
import { AppError } from '@/errors';

import { HttpMethod } from './constants.ts';

import type { Request } from 'express';

/** Decodes HTTP transport using only the JSON fields declared by the caller. */
export function decodeExportInput(req: Request, jsonFields: readonly string[]) {
  if (req.method !== HttpMethod.Get && req.method !== HttpMethod.Head) return req.body;
  const input: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(req.query)) {
    if (typeof value !== 'string')
      throw new AppError(400, ErrorCode.InvalidQueryParameter, `Supply a single value for: ${key}`);
    if (jsonFields.includes(key)) {
      try {
        input[key] = JSON.parse(value);
      } catch {
        throw new AppError(
          400,
          ErrorCode.InvalidQueryParameter,
          `Query parameter must contain valid JSON: ${key}`,
        );
      }
    } else input[key] = value;
  }
  return input;
}
