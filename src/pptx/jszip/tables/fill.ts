import type { Element } from '@xmldom/xmldom';
import { drawing } from '@/pptx/jszip/package/namespaces';
import { invalidTemplate } from '@/pptx/jszip/package/invalid-template';

import { setText } from '@/pptx/jszip/text/set-text';
import { resizeTableRows } from './resize-rows.ts';
import type { FillTableOptions } from './types.ts';

/** Fills table cells, optionally resizing data rows; startRow preserves header rows. */
export function fillTable(
  element: Element,
  data: (string | number)[][],
  { startRow = 0, resizeRows = false }: FillTableOptions = {},
) {
  const table = element.getElementsByTagNameNS(drawing, 'tbl')[0];
  if (!table) throw invalidTemplate();
  const rows = Array.from(table.getElementsByTagNameNS(drawing, 'tr'));
  if (resizeRows) resizeTableRows(element, table, rows, startRow, data.length);
  if (
    !Number.isInteger(startRow) ||
    startRow < 0 ||
    rows.length !== data.length + startRow
  )
    throw invalidTemplate();
  for (const [rowIndex, row] of rows.slice(startRow).entries()) {
    const cells = Array.from(row.getElementsByTagNameNS(drawing, 'tc'));
    if (cells.length !== data[rowIndex].length) throw invalidTemplate();
    for (const [columnIndex, cell] of cells.entries()) {
      setText(cell, String(data[rowIndex][columnIndex]));
    }
  }
}
