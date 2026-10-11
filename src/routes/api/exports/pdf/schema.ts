import { z } from 'zod';

import { resolvePdfPrintSettings } from '@/config';
import { hasControlCharacters } from '@/validation/control-characters';
import { filenameSchema } from '@/validation/filename';

export const pdfSchema = z
  .object({
    route: z
      .string()
      .min(1)
      .max(2000)
      .startsWith('/')
      .refine(
        (v) =>
          !v.startsWith('//') && !v.includes('\\') && !hasControlCharacters(v),
        'Use a relative webapp route',
      ),
    // Explicit parameters supported by the example webapp; unknown keys fail validation.
    query: z
      .object({
        language: z.string().trim().min(1).max(100).optional(),
        year: z
          .union([
            z.number().int().min(2000).max(2100),
            z
              .string()
              .regex(/^\d{4}$/)
              .refine(
                (value) => Number(value) >= 2000 && Number(value) <= 2100,
              ),
          ])
          .optional(),
        quarter: z
          .union([z.number().int().min(1).max(4), z.enum(['1', '2', '3', '4'])])
          .optional(),
        print: z.boolean().optional(),
      })
      .strict()
      .default({}),
    filename: filenameSchema.default('document'),
    waitForSelector: z.string().min(1).max(300).optional(),
    format: z
      .enum(['A3', 'A4', 'A5', 'A6', 'Letter', 'Legal', 'Tabloid', 'Ledger'])
      .default(() => resolvePdfPrintSettings().format),
    landscape: z.boolean().default(() => resolvePdfPrintSettings().landscape),
  })
  .strict();

export type PdfInput = z.infer<typeof pdfSchema>;
