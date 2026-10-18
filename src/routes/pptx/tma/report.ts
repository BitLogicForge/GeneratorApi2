import { ReportErrorMessage } from '@/reports/constants';
import { definePptxReport } from '@/reports/pptx';
import { templateFile } from '@/reports/template';
import { TmxPocPresentationService } from '@/services/jszip/tmx-poc-presentation-service';

import { readRequestInput, requestSchema } from './schema.ts';

import type { z } from 'zod';
import type { PptxReport } from '@/reports/pptx';

const sourceFile = 'Tmp1.pptx';

const report = {
  schema: requestSchema,
  notConfiguredMessage: ReportErrorMessage.TemplateReportDemoNotConfigured,
  readRequestInput,
  prepareInput: ({ TEXT_ME }) => ({
    filename: 'tma',
    input: TEXT_ME,
  }),
  createService: () => new TmxPocPresentationService(templateFile(sourceFile)),
} satisfies PptxReport<z.infer<typeof requestSchema>, string>;

export default definePptxReport(report);
