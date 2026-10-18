import { invalidTemplate } from '@/pptx/jszip/package/invalid-template';
import { drawing } from '@/pptx/jszip/package/namespaces';
import { setText } from '@/pptx/jszip/text/set-text';

import { resizeTableColumns } from './resize-columns.ts';
import { resizeTableRows } from './resize-rows.ts';
import {
  createCellColorsSchema,
  tableOffsetSchema,
  tableRectangularDataSchema,
} from './schema.ts';
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
  if (!tableOffsetSchema.safeParse(startColumn).success)
    throw invalidTemplate();
  if (
    cellColors !== undefined &&
    !createCellColorsSchema(data).safeParse(cellColors).success
  ) {
    throw invalidTemplate(
      'Table cell colors must match data dimensions and contain six-digit RGB hex colors or undefined',
    );
  }
  const rows = Array.from(table.getElementsByTagNameNS(drawing, 'tr'));
  if (resizeColumns) {
    if (!tableRectangularDataSchema.safeParse(data).success)
      throw invalidTemplate();
    resizeTableColumns(element, table, rows, startColumn, data[0].length);
  }
  if (resizeRows) resizeTableRows(element, table, rows, startRow, data.length);
  if (
    !tableOffsetSchema.safeParse(startRow).success ||
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
