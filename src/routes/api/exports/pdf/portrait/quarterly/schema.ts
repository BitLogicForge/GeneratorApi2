import { z } from 'zod';

import type { Request } from 'express';

// Only these parameters are forwarded to the fixed quarterly webapp page.
const webappQuerySchema = z
  .object({
    year: z
      .string()
      .regex(/^\d{4}$/)
      .refine((value) => Number(value) >= 2000 && Number(value) <= 2100)
      .default('2026'),
    quarter: z.enum(['1', '2', '3', '4']).default('3'),
    language: z.enum(['en', 'de', 'pl']).default('en'),
  })
  .strict();

// API request: direct URL parameters become the webapp query.
export const requestSchema = z.object({ query: webappQuerySchema }).strict();

export type RequestInput = z.infer<typeof requestSchema>;

export function readRequestInput(req: Request) {
  return { query: req.query };
}
