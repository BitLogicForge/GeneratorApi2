import { z } from 'zod';

import { documentTextSchema } from '@/validation/schema';

// Adapt this schema to the actual response contract of your future API.
export const reportDataSchema = z.object({
  id: documentTextSchema,
  language: documentTextSchema,
  year: z.number().int(),
  tableData: z.array(z.array(z.number()).length(4)).length(3),
  chartData: z.array(z.array(z.number()).length(3)).length(20),
  categories: z.array(documentTextSchema).length(20),
});
