import { z } from 'zod';

import { documentIdSchema } from '@/validation/document-id';

// Public query parameters for this endpoint. Unknown and repeated values are rejected.
const querySchema = z
  .object({
    language: z.string().trim().min(1).max(100).optional(),
    year: z
      .string()
      .regex(/^\d{4}$/)
      .refine((value) => Number(value) >= 2000 && Number(value) <= 2100)
      .optional(),
  })
  .strict();

export const requestSchema = z
  .object({
    id: documentIdSchema,
    query: querySchema,
  })
  .strict();
