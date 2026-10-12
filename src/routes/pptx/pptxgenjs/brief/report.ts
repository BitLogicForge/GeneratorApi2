import { definePptxReport } from '@/reports/pptx';
import { PowerPointGenerationService } from '@/services/pptxgenjs/power-point-generation-service';

import { readRequestInput, requestSchema } from './schema.ts';

import type { PptxReport } from '@/reports/pptx';
import type { BriefInput } from '@/services/pptxgenjs/contracts';

export const report = {
  schema: requestSchema,
  readRequestInput,
  filename: (input) => input.filename,
  createService: () => {
    const service = new PowerPointGenerationService();
    return { generate: (input) => service.generate('brief', input) };
  },
  injectedService: ({ presentations }) =>
    presentations && {
      generate: (input) => presentations.generate('brief', input),
    },
} satisfies PptxReport<BriefInput>;

export default definePptxReport(report);
