import { ReportErrorMessage } from '@/reports/constants';
import { definePptxReport } from '@/reports/pptx';
import { templateFile } from '@/reports/template';
import { Sample1Service } from '@/services/automizer/sample1-service';

import { readRequestInput, requestSchema } from './schema.ts';

const sourceFile = 'template_3.pptx';

export default definePptxReport({
  schema: requestSchema,
  notConfiguredMessage: ReportErrorMessage.TemplateReportDemoNotConfigured,
  readRequestInput,
  prepareInput: (input) => ({
    filename: 'aab',
    input,
  }),
  createService: () => new Sample1Service(templateFile(sourceFile)),
});
