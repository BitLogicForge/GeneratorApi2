import { z } from 'zod';

import { pdfRenderSchema } from '@/services/pdf/schema';

export const templateFilenameSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]+\.pptx$/, 'Use a template filename without directories');

// Report print settings have one owner: definition.print.
export const preparedInputSchema = pdfRenderSchema.omit({
  landscape: true,
  print: true,
});

export type PreparedPdfInput = z.input<typeof preparedInputSchema> & {
  landscape?: never;
  print?: never;
};
