import { definePptxReport } from '@/reports/pptx';
import { templateFile } from '@/reports/template';
import { DaaPocPresentationService } from '@/services/jszip/daa-poc-presentation-service';

import { readRequestInput, requestSchema } from './schema.ts';

import type { z } from 'zod';
import type { PptxReport } from '@/reports/pptx';

export const report = {
  schema: requestSchema,
  notConfiguredMessage: 'Template report demo not configured',
  readRequestInput,
  filename: 'demo-report',
  createService: () => {
    const service = new DaaPocPresentationService(templateFile('daa.pptx'));
    return {
      generate: (input) => service.generate(input.TEXT_ME),
      validate: () => service.validate(),
    };
  },
  injectedService: ({ templateReportDemo }) =>
    templateReportDemo && {
      generate: (input) => templateReportDemo.generate(input.TEXT_ME),
    },
} satisfies PptxReport<z.infer<typeof requestSchema>>;

export default definePptxReport(report);
