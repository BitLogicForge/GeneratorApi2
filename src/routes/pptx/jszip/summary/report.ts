import { definePptxReport } from '@/reports/pptx';
import { templateService } from '@/reports/template';
import { pptxRenderSchema } from '@/services/jszip/contracts';

import { readRequestInput, requestSchema } from './schema.ts';

import type { z } from 'zod';
import type { PptxReport } from '@/reports/pptx';
import type { PptxRenderInput } from '@/services/jszip/contracts';

// Server-owned template target; request parameters cannot select a file.
const template = 'summary';
const sourceFile = 'summary.pptx';

export const report = {
  schema: requestSchema,
  readRequestInput,
  notConfiguredMessage: 'PowerPoint file template not found',
  prepareInput: ({ filename, replacements }) => ({
    filename,
    input: pptxRenderSchema.parse({ filename, replacements }),
  }),
  ...templateService(template, sourceFile),
} satisfies PptxReport<z.infer<typeof requestSchema>, PptxRenderInput>;

export default definePptxReport(report);
