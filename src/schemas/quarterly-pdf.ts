import { z } from 'zod';

// Direct GET parameters for the fixed quarterly-report PDF example.
export const quarterlyPdfQuerySchema = z
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

export type QuarterlyPdfQuery = z.infer<typeof quarterlyPdfQuerySchema>;
