import { definePptxReport } from '@/reports/pptx';
import { templateFile } from '@/reports/template';
import { DaaPocPresentationService } from '@/services/jszip/daa-poc-presentation-service';

import { readRequestInput, requestSchema } from './schema.ts';

import type { z } from 'zod';
import type { PptxReport } from '@/reports/pptx';

const sourceFile = 'daa.pptx';

export const report = {
  schema: requestSchema,
  notConfiguredMessage: 'Template report demo not configured',
  readRequestInput,
  prepareInput: ({ TEXT_ME }) => ({
    filename: 'demo-report',
    input: TEXT_ME,
  }),
  createService: () => new DaaPocPresentationService(templateFile(sourceFile)),
  injectedService: ({ templateReportDemo }) => templateReportDemo,
} satisfies PptxReport<z.infer<typeof requestSchema>, string>;

export default definePptxReport(report);
