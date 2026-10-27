import { z } from 'zod';

/** Six-character RGB hex color string (e.g. '2563EB', 'ff0000'). */
export const hexColorSchema = z.hex().length(6);

/** Safe identifier or filename component containing ASCII letters, digits, underscores, or hyphens. */
const slugOrIdSchema = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[A-Za-z0-9_-]+$/);

export const documentIdSchema = slugOrIdSchema;
export const filenameSchema = slugOrIdSchema;

/** XML 1.0 permits tabs, line endings and Unicode scalar values, but not lone surrogates. */
export const documentTextSchema = z.string().refine((value) => {
  for (const character of value) {
    const code = character.codePointAt(0)!;
    if (
      code !== 9 &&
      code !== 10 &&
      code !== 13 &&
      !(code >= 0x20 && code <= 0xd7ff) &&
      !(code >= 0xe000 && code <= 0xfffd) &&
      !(code >= 0x10000 && code <= 0x10ffff)
    )
      return false;
  }
  return true;
}, 'Text contains characters that XML 1.0 cannot represent');

/** Parses a JSON array query value such as `["SAA","REPORTING"]`; other values pass through. */
function parseJsonArray(value: unknown): unknown {
  if (typeof value !== 'string' || !value.startsWith('[')) return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

/** Query list given once, repeated (`?K=a&K=b`), or as a JSON array (`?K=["a","b"]`). */
export function queryListSchema<Item extends z.ZodType>(item: Item, max: number) {
  return z.preprocess((value) => {
    const parsed = parseJsonArray(value);
    return Array.isArray(parsed) ? parsed : [parsed];
  }, z.array(item).min(1).max(max));
}
