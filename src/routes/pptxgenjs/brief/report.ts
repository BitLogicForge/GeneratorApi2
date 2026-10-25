import { definePptxReport } from '@/reports/pptx';
import { PowerPointGenerationService } from '@/services/pptxgenjs/power-point-generation-service';

import { readRequestInput, requestSchema } from './schema.ts';

import type { z } from 'zod';
import type { PptxReport } from '@/reports/pptx';
import type { BriefInput } from '@/services/pptxgenjs/schema';

// Server-owned generated design.
const layout = 'brief';

const report = {
  schema: requestSchema,
  readRequestInput,
  // The request schema already applies every renderer default, so no second parse is needed.
  prepareInput: (input) => ({ filename: input.filename, input }),
  createService: () => {
    const service = new PowerPointGenerationService();
    return { generate: (input) => service.generate(layout, input) };
  },
} satisfies PptxReport<z.infer<typeof requestSchema>, BriefInput>;

export default definePptxReport(report);
