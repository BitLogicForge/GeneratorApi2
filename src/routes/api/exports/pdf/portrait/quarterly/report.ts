import { z } from 'zod';

import { definePdfReport } from '@/reports/pdf';

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
const requestSchema = z.object({ query: webappQuerySchema }).strict();

export default definePdfReport({
  schema: requestSchema,
  readRequestInput: (req) => ({ query: req.query }),
  prepareInput: ({ query }) => ({
    route: '/reports/quarterly',
    query,
    filename: `quarterly-${query.year}-q${query.quarter}-${query.language}`,
    waitForSelector: '[data-report-ready]',
    landscape: false,
  }),
});
