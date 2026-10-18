import { randomInt } from 'node:crypto';

import { positiveDimensionSchema } from './schema.ts';

/** Configures the template width once; each call supplies only the row count. */
export function createRandomDataGenerator(
  columns = 1,
  nextNumber: () => number = () => randomInt(1, 101),
) {
  if (!positiveDimensionSchema.safeParse(columns).success)
    throw new RangeError('Column count must be a positive safe integer');

  return (rows: number): number[][] => {
    if (!positiveDimensionSchema.safeParse(rows).success)
      throw new RangeError('Row count must be a positive safe integer');
    return Array.from({ length: rows }, () =>
      Array.from({ length: columns }, () => nextNumber()),
    );
  };
}
