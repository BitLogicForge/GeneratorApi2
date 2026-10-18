import { z } from 'zod';

import { mapQuery } from '@/url';
import { documentIdSchema } from '@/validation/schema';

// Public query parameters for this endpoint. Unknown and repeated values are rejected.
const querySchema = z
  .object({
    START: z.iso.date().optional(),
    END: z.iso.date().optional(),
    BENCHMARK: z.enum(['SAA', 'REPORTING']).optional(),
  })
  .strict();

// Public query name -> external webapp query name. Change values to rename fields.
const externalQueryNames = {
  START: 'START',
  END: 'END',
  BENCHMARK: 'BENCHMARK',
} satisfies Record<keyof z.infer<typeof querySchema>, string>;

export const requestSchema = z
  .object({
    id: documentIdSchema,
    query: querySchema.transform((query) =>
      mapQuery(query, externalQueryNames),
    ),
  })
  .strict();
