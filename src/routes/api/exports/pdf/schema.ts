import { z } from 'zod';

import { resolvePdfPrintSettings } from '@/config';
import { hasControlCharacters } from '@/validation/control-characters';
import { filenameSchema } from '@/validation/filename';

/** Shared PDF renderer contract, used by every PDF endpoint. */
export const pdfRenderSchema = z
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
    // Internal transport values; each route validates its own allowed parameter names.
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

export type PdfRenderInput = z.infer<typeof pdfRenderSchema>;
