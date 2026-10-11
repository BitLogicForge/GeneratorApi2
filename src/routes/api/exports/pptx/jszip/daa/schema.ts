import { z } from 'zod';

import { documentTextSchema } from '@/validation/document-text';

import type { Request } from 'express';

export const inputSchema = z
  .object({ TEXT_ME: documentTextSchema.max(5000).default('Generated report') })
  .strict();

/** DAA accepts direct text query parameters for GET and HEAD. */
export function readInput(req: Request) {
  return req.query;
}
