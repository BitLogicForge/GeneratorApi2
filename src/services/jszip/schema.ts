import { z } from 'zod';

import { documentTextSchema } from '@/validation/document-text';
import { filenameSchema } from '@/validation/filename';

// Shared renderer contract for placeholder-based PPTX templates.
export const pptxRenderSchema = z
  .object({
    filename: filenameSchema.default('presentation'),
    replacements: z
      .record(
        z.string().regex(/^[A-Za-z][A-Za-z0-9_]{0,63}$/),
        documentTextSchema.max(5000),
      )
      .refine(
        (value) =>
          Object.keys(value).length > 0 && Object.keys(value).length <= 100,
        'Supply 1–100 replacements',
      ),
  })
  .strict();

export type PptxRenderInput = z.infer<typeof pptxRenderSchema>;

export const positiveDimensionSchema = z
  .number()
  .refine((val) => Number.isSafeInteger(val) && val >= 1);
