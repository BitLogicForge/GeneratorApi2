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
    query: z
      .record(
        z.string().max(100),
        z.union([z.string().max(2000), z.number(), z.boolean()]),
      )
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
