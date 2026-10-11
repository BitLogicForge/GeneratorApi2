import { columnName } from './column-name.ts';

import type { Element } from '@xmldom/xmldom';
import type { WorksheetBounds } from './types.ts';

export function updateWorksheetDimension(
  dimension: Element,
  bounds: WorksheetBounds,
) {
  const start = bounds.lastColumn
    ? `${columnName(bounds.firstColumn)}${bounds.firstRow}`
    : 'A1';
  const end = bounds.lastColumn
    ? `${columnName(bounds.lastColumn)}${bounds.lastRow}`
    : 'A1';
  dimension.setAttribute('ref', start === end ? start : `${start}:${end}`);
}
