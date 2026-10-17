import { definePptxReport } from '@/reports/pptx';
import { briefInputSchema } from '@/services/pptxgenjs/contracts';
import { PowerPointGenerationService } from '@/services/pptxgenjs/power-point-generation-service';

import { readRequestInput, requestSchema } from './schema.ts';

import type { z } from 'zod';
import type { PptxReport } from '@/reports/pptx';
import type { BriefInput } from '@/services/pptxgenjs/contracts';

// Server-owned generated design.
const template = 'brief';

export const report = {
  schema: requestSchema,
  readRequestInput,
  prepareInput: ({ filename, title, subtitle, author, accent, slides }) => ({
    filename,
    input: briefInputSchema.parse({
      filename,
      title,
      subtitle,
      author,
      accent,
      slides,
    }),
  }),
  createService: () => {
    const service = new PowerPointGenerationService();
    return { generate: (input) => service.generate(template, input) };
  },
} satisfies PptxReport<z.infer<typeof requestSchema>, BriefInput>;

export default definePptxReport(report);
