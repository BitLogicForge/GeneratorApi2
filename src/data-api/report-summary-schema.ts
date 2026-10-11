import { z } from 'zod';

export const reportSummarySchema = z.object({
  id: z.string(),
  customerId: z.string(),
  language: z.string(),
  year: z.number().int(),
  totalRevenue: z.number().nonnegative(),
  growthPercent: z.number(),
});
