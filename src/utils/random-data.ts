import { randomInt } from 'node:crypto';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function randomLetters(length: number): string {
  return Array.from(
    { length },
    () => LETTERS[randomInt(0, LETTERS.length)],
  ).join('');
}

const VALUE_GENERATORS = {
  number: () => randomInt(1, 101),
  boolean: () => randomInt(0, 2) === 1,
  string: () => randomLetters(3),
  longString: () => randomLetters(randomInt(4, 15)),
  color: () =>
    randomInt(0, 0x1000000).toString(16).toUpperCase().padStart(6, '0'),
} as const;

export type RandomDataType = keyof typeof VALUE_GENERATORS;

function isPositiveSafeInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 1;
}

/**
 * Generates a `rows x columns` matrix of random values:
 * - `'number'` (default): integers in `1..100`
 * - `'boolean'`: `true` or `false`
 * - `'string'`: 3-letter uppercase strings (`A-Z`)
 * - `'longString'`: 4-to-14-letter uppercase strings (`A-Z`)
 * - `'color'`: 6-digit uppercase RGB hex strings (`000000..FFFFFF`)
 */
export function generateRandomData<T extends RandomDataType = 'number'>(
  rows: number,
  columns = 1,
  type: T = 'number' as T,
): ReturnType<(typeof VALUE_GENERATORS)[T]>[][] {
  if (!isPositiveSafeInteger(rows))
    throw new RangeError('Row count must be a positive safe integer');
  if (!isPositiveSafeInteger(columns))
    throw new RangeError('Column count must be a positive safe integer');
  const generateValue = VALUE_GENERATORS[type] as () => ReturnType<
    (typeof VALUE_GENERATORS)[T]
  >;
  return Array.from({ length: rows }, () =>
    Array.from({ length: columns }, generateValue),
  );
}

/** Pairs parallel `labels` and `values` arrays into `[label, ...values]` table rows. */
export function zipLabelsAndValues<T extends number | string>(series: {
  labels: readonly string[];
  values: readonly (T | readonly T[])[];
}): (string | T)[][] {
  return series.labels.map((label, index) => {
    const value = series.values[index];
    return Array.isArray(value) ? [label, ...value] : [label, value];
  });
}

/** Builds table rows with a legend `marker` inserted at `colorColumn` (0-based, default `0`). */
export function zipLegendLabelsAndValues<T extends number | string>(
  series: {
    labels: readonly string[];
    values: readonly (T | readonly T[])[];
  },
  colorColumn = 0,
  marker = 'g',
): (string | T)[][] {
  return zipLabelsAndValues(series).map((row) => {
    const copy = [...row];
    copy.splice(colorColumn, 0, marker);
    return copy;
  });
}

/** Creates a `cellColors` matrix that colors `colorColumn` (0-based, default `0`) of each row. */
export function toColumnCellColors(
  colors: readonly string[],
  columnCount = 3,
  colorColumn = 0,
): (string | undefined)[][] {
  return colors.map((color) =>
    Array.from({ length: columnCount }, (_, index) =>
      index === colorColumn ? color : undefined,
    ),
  );
}
