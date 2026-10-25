import { z } from 'zod';

import { documentTextSchema } from '@/validation/schema';

export const reportSummarySchema = z.object({
  id: documentTextSchema,
  customerId: documentTextSchema,
  language: documentTextSchema,
  year: z.number().int(),
  totalRevenue: z.number().nonnegative(),
  growthPercent: z.number(),
});
