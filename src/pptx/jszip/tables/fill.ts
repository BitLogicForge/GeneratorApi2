import { invalidTemplate } from '@/pptx/jszip/package/invalid-template';
import { drawing } from '@/pptx/jszip/package/namespaces';
import { setText } from '@/pptx/jszip/text/set-text';

import { resizeTableColumns } from './resize-columns.ts';
import { resizeTableRows } from './resize-rows.ts';
import { setCellTextColor } from './set-cell-text-color.ts';

import type { Element } from '@xmldom/xmldom';
import type { FillTableOptions } from './types.ts';

/** Fills table cells, preserving rows/columns before the starting offsets. */
export function fillTable(
  element: Element,
  data: (string | number)[][],
  {
    startRow = 0,
    startColumn = 0,
    resizeRows = false,
    resizeColumns = false,
    cellColors,
  }: FillTableOptions = {},
) {
  const table = element.getElementsByTagNameNS(drawing, 'tbl')[0];
  if (!table) throw invalidTemplate();
  if (!Number.isInteger(startColumn) || startColumn < 0)
    throw invalidTemplate();
  if (cellColors !== undefined) {
    if (
      !Array.isArray(cellColors) ||
      cellColors.length !== data.length ||
      cellColors.some(
        (row, index) =>
          !Array.isArray(row) ||
          row.length !== data[index].length ||
          row.some(
            (color) =>
              color !== undefined &&
              (typeof color !== 'string' || !/^[0-9a-f]{6}$/i.test(color)),
          ),
      )
    )
      throw invalidTemplate(
        'Table cell colors must match data dimensions and contain six-digit RGB hex colors or undefined',
      );
  }
  const rows = Array.from(table.getElementsByTagNameNS(drawing, 'tr'));
  if (resizeColumns) {
    const columnCount = data[0]?.length ?? 0;
    if (!columnCount || data.some((row) => row.length !== columnCount))
      throw invalidTemplate();
    resizeTableColumns(element, table, rows, startColumn, columnCount);
  }
  if (resizeRows) resizeTableRows(element, table, rows, startRow, data.length);
  if (
    !Number.isInteger(startRow) ||
    startRow < 0 ||
    rows.length !== data.length + startRow
  )
    throw invalidTemplate();
  for (const [rowIndex, row] of rows.slice(startRow).entries()) {
    const cells = Array.from(row.getElementsByTagNameNS(drawing, 'tc'));
    if (cells.length !== data[rowIndex].length + startColumn)
      throw invalidTemplate();
    for (const [columnIndex, cell] of cells.slice(startColumn).entries()) {
      setText(cell, String(data[rowIndex][columnIndex]));
      const color = cellColors?.[rowIndex][columnIndex];
      if (color !== undefined) setCellTextColor(cell, color);
    }
  }
}
