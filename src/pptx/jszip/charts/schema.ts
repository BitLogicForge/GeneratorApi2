import { z } from 'zod';

import type { CategoryChartOptions } from './types.ts';

export const MAX_WORKSHEET_COLUMNS = 16384;
export const MAX_WORKSHEET_ROWS = 1048576;

export const columnNameSchema = z.string().regex(/^[A-Z]+$/);

export const columnNumberSchema = z
  .number()
  .int()
  .min(1)
  .max(MAX_WORKSHEET_COLUMNS);

const chartDataSchema = z
  .array(z.array(z.number().refine(Number.isFinite)))
  .min(1)
  .refine(
    (rows) =>
      rows[0].length > 0 && rows.every((row) => row.length === rows[0].length),
  );

function createChartColorsSchema(expectedLength: number) {
  return z
    .array(z.string().regex(/^[0-9a-f]{6}$/i))
    .length(
      expectedLength,
      'Chart colors require one six-digit RGB hex color per data row',
    );
}

export function validateCategoryChartInput(
  data: number[][],
  options: CategoryChartOptions,
): { valid: true } | { valid: false; colorsError?: boolean } {
  if (!chartDataSchema.safeParse(data).success) return { valid: false };
  if (options.categories && options.categories.length !== data.length) {
    return { valid: false };
  }
  if (options.seriesNames && options.seriesNames.length !== data[0].length) {
    return { valid: false };
  }
  if (options.colors) {
    if (
      !createChartColorsSchema(data.length).safeParse(options.colors).success
    ) {
      return { valid: false, colorsError: true };
    }
  }
  return { valid: true };
}
