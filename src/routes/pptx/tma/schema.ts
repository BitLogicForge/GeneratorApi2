import { z } from 'zod';

import { documentTextSchema } from '@/validation/schema';

import type { Request } from 'express';

// API request parameters for the demo deck; no webapp query is used.
export const requestSchema = z
  .object({
    TEXT_ME: documentTextSchema.max(5000).default('Generated report'),
    PP1: documentTextSchema.max(5000).default('Sample Value 1'),
    PP2: documentTextSchema.max(5000).default('Sample Value 2'),
  })

  .strict();

export type TmaRequestInput = z.infer<typeof requestSchema>;

/** DAA accepts direct text query parameters for GET and HEAD. */
export function readRequestInput(req: Request) {
  return req.query;
}
