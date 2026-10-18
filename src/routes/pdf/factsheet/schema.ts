import { z } from 'zod';

import { documentIdSchema } from '@/validation/document-id';

// Public query parameters for this endpoint. Unknown and repeated values are rejected.
const querySchema = z
  .object({})
  .strict();

export const requestSchema = z
  .object({
    id: documentIdSchema,
    query: querySchema,
  })
  .strict();
