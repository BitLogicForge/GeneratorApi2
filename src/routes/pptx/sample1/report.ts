import { ReportErrorMessage } from '@/reports/constants';
import { definePptxReport } from '@/reports/pptx';
import { templateFile } from '@/reports/template';
import { Sample1Service } from '@/services/jszip/Sample1/sample1-service';

import { readRequestInput, requestSchema } from './schema.ts';

const sourceFile = 'template_3_duplicated.pptx';

export default definePptxReport({
  schema: requestSchema,
  notConfiguredMessage: ReportErrorMessage.TemplateReportDemoNotConfigured,
  readRequestInput,
  prepareInput: (input) => ({
    filename: 'sample1',
    input,
  }),
  createService: () => new Sample1Service(templateFile(sourceFile)),
});
