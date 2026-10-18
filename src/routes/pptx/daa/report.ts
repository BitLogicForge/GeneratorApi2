import { ErrorMessage } from '@/constants';
import { definePptxReport } from '@/reports/pptx';
import { templateFile } from '@/reports/template';
import { DaaPocPresentationService } from '@/services/jszip/daa-poc-presentation-service';

import { readRequestInput, requestSchema } from './schema.ts';

import type { z } from 'zod';
import type { PptxReport } from '@/reports/pptx';

const sourceFile = 'daa.pptx';

const report = {
  schema: requestSchema,
  notConfiguredMessage: ErrorMessage.TemplateReportDemoNotConfigured,
  readRequestInput,
  prepareInput: ({ TEXT_ME }) => ({
    filename: 'demo-report',
    input: TEXT_ME,
  }),
  createService: () => new DaaPocPresentationService(templateFile(sourceFile)),
} satisfies PptxReport<z.infer<typeof requestSchema>, string>;

export default definePptxReport(report);
