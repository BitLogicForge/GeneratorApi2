import { invalidTemplate } from '@/pptx/jszip/package/invalid-template';

import { columnNameToNumber, MAX_WORKSHEET_COLUMNS, MAX_WORKSHEET_ROWS } from './columns.ts';

import type { Element } from '@xmldom/xmldom';

export function readCellAddress(cell: Element, previousColumn: number, rowNumber: number) {
  const reference = cell.getAttribute('r');
  const address = reference ? /^([A-Z]+)([1-9]\d*)$/.exec(reference) : null;
  if (reference && !address) throw invalidTemplate();
  const column = address ? columnNameToNumber(address[1]) : previousColumn + 1;
  const row = address ? Number(address[2]) : rowNumber;
  if (column > MAX_WORKSHEET_COLUMNS || row > MAX_WORKSHEET_ROWS) throw invalidTemplate();
  return { column, row };
}
