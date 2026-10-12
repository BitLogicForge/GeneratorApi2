import { z } from 'zod';

import { documentIdSchema } from '@/validation/document-id';

// Public query parameters for this endpoint. Unknown and repeated values are rejected.
const querySchema = z
  .object({
    START: z.iso.date().optional(),
    END: z.iso.date().optional(),
    BENCHMARK: z.enum(['SAA', 'REPORTING']).optional(),
  })
  .strict();

export const requestSchema = z
  .object({
    id: documentIdSchema,
    query: querySchema,
  })
  .strict();
