import { z } from 'zod';

import { hexColorSchema } from '@/validation/schema';

import type { CategoryChartOptions } from './types.ts';

export const MAX_WORKSHEET_COLUMNS = 16384;
export const MAX_WORKSHEET_ROWS = 1048576;

export const columnNameSchema = z.string().regex(/^[A-Z]+$/);

export const columnNumberSchema = z.number().int().min(1).max(MAX_WORKSHEET_COLUMNS);

const chartDataSchema = z
  .array(z.array(z.number().refine(Number.isFinite)))
  .min(1)
  .refine((rows) => rows[0].length > 0 && rows.every((row) => row.length === rows[0].length));

function createChartColorsSchema(expectedLength: number) {
  return z
    .array(hexColorSchema)
    .length(expectedLength, 'Chart colors require one six-digit RGB hex color per data row');
}

/** Returns the first problem found, phrased for logs, so callers can report exactly what failed. */
export function validateCategoryChartInput(
  data: number[][],
  options: CategoryChartOptions,
): { valid: true } | { valid: false; reason: string } {
  if (!chartDataSchema.safeParse(data).success)
    return {
      valid: false,
      reason: `Chart data must be a non-empty matrix of finite numbers with equal row lengths (row lengths: ${JSON.stringify(data.map((row) => row.length))})`,
    };
  if (options.categories && options.categories.length !== data.length) {
    return {
      valid: false,
      reason: `Chart categories count ${options.categories.length} does not match ${data.length} data rows`,
    };
  }
  if (options.seriesNames && options.seriesNames.length !== data[0].length) {
    return {
      valid: false,
      reason: `Chart seriesNames count ${options.seriesNames.length} does not match ${data[0].length} data columns`,
    };
  }
  if (options.colors) {
    if (!createChartColorsSchema(data.length).safeParse(options.colors).success) {
      return {
        valid: false,
        reason: `Chart colors require one six-digit RGB hex color per data row (${options.colors.length} colors for ${data.length} rows)`,
      };
    }
  }
  return { valid: true };
}
