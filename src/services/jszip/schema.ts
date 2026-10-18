import { z } from 'zod';

import { documentTextSchema, filenameSchema } from '@/validation/schema';

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
