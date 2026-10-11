import { z } from 'zod';

import { documentIdSchema } from '@/pdf-route';

/** Only these direct URL parameters may be forwarded to the document page. */
export const documentPdfRequestSchema = z
  .object({
    id: documentIdSchema,
    query: z
      .object({
        language: z.string().trim().min(1).max(100).optional(),
        year: z
          .string()
          .regex(/^\d{4}$/)
          .refine((value) => Number(value) >= 2000 && Number(value) <= 2100)
          .optional(),
      })
      .strict(),
  })
  .strict();
