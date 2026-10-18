import { ReportErrorMessage } from '@/reports/constants';
import { definePptxReport } from '@/reports/pptx';
import { templateFile } from '@/reports/template';
import { TmxPresentationService } from '@/services/automizer/tmx-presentation-service';

import { readRequestInput, requestSchema } from './schema.ts';

const sourceFile = 'Tmp1.pptx';

export default definePptxReport({
  schema: requestSchema,
  notConfiguredMessage: ReportErrorMessage.TemplateReportDemoNotConfigured,
  readRequestInput,
  prepareInput: (input) => ({
    filename: 'tma',
    input,
  }),
  createService: () => new TmxPresentationService(templateFile(sourceFile)),
});
