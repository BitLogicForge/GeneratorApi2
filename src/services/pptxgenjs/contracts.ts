import { z } from 'zod';

import { documentTextSchema } from '@/validation/document-text';
import { filenameSchema } from '@/validation/filename';

// API request fields for the brief presentation.
export const briefInputSchema = z
  .object({
    filename: filenameSchema.default('presentation'),
    title: documentTextSchema.min(1).max(100),
    subtitle: documentTextSchema.max(180).default(''),
    author: documentTextSchema.max(100).default('Generator API'),
    accent: z
      .string()
      .regex(/^[0-9a-fA-F]{6}$/)
      .default('2563EB'),
    slides: z
      .array(
        z
          .object({
            title: documentTextSchema.min(1).max(100),
            bullets: z.array(documentTextSchema.min(1).max(220)).min(1).max(6),
            notes: documentTextSchema.max(3000).optional(),
          })
          .strict(),
      )
      .min(1)
      .max(30),
  })
  .strict();

export type BriefInput = z.infer<typeof briefInputSchema>;
