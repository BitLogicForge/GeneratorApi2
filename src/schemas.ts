import { z } from 'zod';

import { documentTextSchema } from './validation/document-text.ts';
import { filenameSchema } from './validation/filename.ts';

export const presentationSchema = z
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

export type PresentationInput = z.infer<typeof presentationSchema>;

export const templatePresentationSchema = z
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
export type TemplatePresentationInput = z.infer<
  typeof templatePresentationSchema
>;
