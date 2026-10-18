import { z } from 'zod';

const hexColorSchema = z.string().regex(/^[0-9a-f]{6}$/i);

export const tableOffsetSchema = z.number().int().min(0);

export const tableRectangularDataSchema = z
  .array(z.array(z.union([z.string(), z.number()])))
  .min(1)
  .refine(
    (rows) =>
      rows[0].length > 0 && rows.every((row) => row.length === rows[0].length),
  );

/** Validates that cell colors match the 2D dimensions of table data and contain valid hex colors or undefined. */
export function createCellColorsSchema(data: readonly (readonly unknown[])[]) {
  return z
    .array(z.array(hexColorSchema.optional()))
    .length(data.length)
    .refine((rows) =>
      rows.every((row, index) => row.length === data[index].length),
    );
}
