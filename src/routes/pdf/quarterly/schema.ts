import { z } from 'zod';

// Only these parameters are forwarded to the fixed quarterly webapp page.
const querySchema = z
  .object({
    year: z.coerce.number().int().min(2000).max(2100).default(2026).transform(String),
    quarter: z.enum(['1', '2', '3', '4']).default('3'),
    language: z.enum(['en', 'de', 'pl']).default('en'),
  })
  .strict();

// API request: direct URL parameters become the webapp query.
export const requestSchema = z.object({ query: querySchema }).strict();
