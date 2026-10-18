import { ReportErrorMessage } from '@/reports/constants';
import { definePptxReport } from '@/reports/pptx';
import { templateFile } from '@/reports/template';
import { DaaPocPresentationService } from '@/services/jszip/daa-poc-presentation-service';

import { readRequestInput, requestSchema } from './schema.ts';

const sourceFile = 'daa.pptx';

export default definePptxReport({
  schema: requestSchema,
  notConfiguredMessage: ReportErrorMessage.TemplateReportDemoNotConfigured,
  readRequestInput,
  prepareInput: (input) => ({
    filename: 'demo-report',
    input,
  }),
  createService: ({ dataApi }) =>
    new DaaPocPresentationService(templateFile(sourceFile), { dataApi }),
});
