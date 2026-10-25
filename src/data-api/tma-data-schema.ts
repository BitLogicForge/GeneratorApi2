import { z } from 'zod';

import { documentTextSchema, hexColorSchema } from '@/validation/schema';

export const tmaSeriesDataSchema = z.object({
  pp1: documentTextSchema,
  asOf: z.iso.datetime(),
  title: documentTextSchema,
  values: z.array(z.array(z.number()).length(1)).length(20),
});

export const tmaBreakdownDataSchema = z.object({
  pp2: documentTextSchema,
  title: documentTextSchema,
  values: z.array(z.array(z.number()).length(1)).length(4),
  colors: z.array(hexColorSchema).length(4),
});

export type TmaSeriesData = z.infer<typeof tmaSeriesDataSchema>;
export type TmaBreakdownData = z.infer<typeof tmaBreakdownDataSchema>;
