import { invalidTemplate } from '@/pptx/jszip/package/invalid-template';

export const MAX_WORKSHEET_COLUMNS = 16384;
export const MAX_WORKSHEET_ROWS = 1048576;

/** Converts an Excel column name (e.g. 'A', 'Z', 'AA', 'XFD') to a 1-based column index. */
export function columnNameToNumber(column: string): number {
  if (!/^[A-Z]+$/.test(column)) throw invalidTemplate();
  let number = 0;
  for (let i = 0; i < column.length; i++) {
    number = number * 26 + column.charCodeAt(i) - 64;
  }
  if (number < 1 || number > MAX_WORKSHEET_COLUMNS) throw invalidTemplate();
  return number;
}

/** Converts a 1-based column index to an Excel column name (e.g. 1 -> 'A', 27 -> 'AA'). */
export function columnNumberToName(value: number): string {
  if (!Number.isInteger(value) || value < 1 || value > MAX_WORKSHEET_COLUMNS) {
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
