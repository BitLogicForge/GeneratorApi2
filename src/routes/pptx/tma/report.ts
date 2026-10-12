import { definePptxReport } from '@/reports/pptx';
import { templateFile } from '@/reports/template';

import { readRequestInput, requestSchema } from './schema.ts';

import type { PptxReport } from '@/reports/pptx';
import { TmxPocPresentationService } from '@/services/jszip/tmx-poc-presentation-service';
import type { z } from 'zod';

const sourceFile = 'Tmp1.pptx';

export const report = {
  schema: requestSchema,
  notConfiguredMessage: 'Template report demo not configured',
  readRequestInput,
  prepareInput: ({ TEXT_ME }) => ({
    filename: 'tma',
    input: TEXT_ME,
  }),
  createService: () => new TmxPocPresentationService(templateFile(sourceFile)),
  injectedService: ({ templateReportDemo }) => templateReportDemo,
} satisfies PptxReport<z.infer<typeof requestSchema>, string>;

export default definePptxReport(report);
