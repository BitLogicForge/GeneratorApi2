import { randomInt } from 'node:crypto';

function isPositiveSafeInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 1;
}

/** Configures the matrix width once; each call supplies only the row count. */
export function createRandomDataGenerator(columns = 1) {
  if (!isPositiveSafeInteger(columns))
    throw new RangeError('Column count must be a positive safe integer');

  return (rows: number): number[][] => {
    if (!isPositiveSafeInteger(rows))
      throw new RangeError('Row count must be a positive safe integer');
    return Array.from({ length: rows }, () =>
      Array.from({ length: columns }, () => randomInt(1, 101)),
    );
  };
}
