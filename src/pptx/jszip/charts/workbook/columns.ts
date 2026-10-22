import { invalidTemplate } from '@/pptx/jszip/package/invalid-template';

import {
  columnNameSchema,
  columnNumberSchema,
  MAX_WORKSHEET_COLUMNS,
  MAX_WORKSHEET_ROWS,
} from '../schema.ts';

export { MAX_WORKSHEET_COLUMNS, MAX_WORKSHEET_ROWS };

/** Converts an Excel column name (e.g. 'A', 'Z', 'AA', 'XFD') to a 1-based column index. */
export function columnNameToNumber(column: string): number {
  if (!columnNameSchema.safeParse(column).success) throw invalidTemplate();
  let number = 0;
  for (let i = 0; i < column.length; i++) {
    number = number * 26 + column.charCodeAt(i) - 64;
  }
  if (!columnNumberSchema.safeParse(number).success) throw invalidTemplate();
  return number;
}

/** Converts a 1-based column index to an Excel column name (e.g. 1 -> 'A', 27 -> 'AA'). */
export function columnNumberToName(value: number): string {
  if (!columnNumberSchema.safeParse(value).success) {
    throw invalidTemplate();
  }
  let name = '';
  let current = value;
  while (current > 0) {
    current--;
    name = String.fromCharCode(65 + (current % 26)) + name;
    current = Math.floor(current / 26);
  }
  return name;
}
