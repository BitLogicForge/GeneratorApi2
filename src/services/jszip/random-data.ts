import { randomInt } from 'node:crypto';

/** Configures the template width once; each call supplies only the row count. */
export function createRandomDataGenerator(
  columns = 1,
  nextNumber: () => number = () => randomInt(1, 101),
) {
  if (!Number.isSafeInteger(columns) || columns < 1)
    throw new RangeError('Column count must be a positive safe integer');

  return (rows: number): number[][] => {
    if (!Number.isSafeInteger(rows) || rows < 1)
      throw new RangeError('Row count must be a positive safe integer');
    return Array.from({ length: rows }, () =>
      Array.from({ length: columns }, () => nextNumber()),
    );
  };
}
