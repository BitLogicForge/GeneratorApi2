import { z } from 'zod';

import { documentTextSchema } from '@/validation/schema';

import type { Request } from 'express';

// API request parameters for the demo deck; no webapp query is used.
export const requestSchema = z
  .object({
    title: documentTextSchema.max(5000).default('Generated report'),
    someText: documentTextSchema.max(5000).default('Some default text'),
  })
  .strict();

export type Sample1RequestInput = z.infer<typeof requestSchema>;

/** DAA accepts direct text query parameters for GET and HEAD. */
export function readRequestInput(req: Request) {
  return req.query;
}
