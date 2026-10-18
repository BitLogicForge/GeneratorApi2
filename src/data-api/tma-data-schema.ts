import { z } from 'zod';

import { hexColorSchema } from '@/validation/schema';

export const tmaSeriesDataSchema = z.object({
  pp1: z.string(),
  asOf: z.iso.datetime(),
  title: z.string(),
  values: z.array(z.array(z.number()).length(1)).length(20),
});

export const tmaBreakdownDataSchema = z.object({
  pp2: z.string(),
  title: z.string(),
  values: z.array(z.array(z.number()).length(1)).length(4),
  colors: z.array(hexColorSchema).length(4),
});

export type TmaSeriesData = z.infer<typeof tmaSeriesDataSchema>;
export type TmaBreakdownData = z.infer<typeof tmaBreakdownDataSchema>;
