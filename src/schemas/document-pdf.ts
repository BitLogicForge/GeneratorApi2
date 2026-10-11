import { z } from 'zod';

import { documentIdSchema } from '@/pdf-route';

/** Path ID plus direct webapp query strings for document download routes. */
export const documentPdfRequestSchema = z
  .object({
    id: documentIdSchema,
    query: z.record(z.string().max(100), z.string().max(2000)),
  })
  .strict();

export type DocumentPdfRequest = z.infer<typeof documentPdfRequestSchema>;
