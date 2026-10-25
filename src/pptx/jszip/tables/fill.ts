import { invalidTemplate } from '@/pptx/jszip/package/invalid-template';
import { drawing } from '@/pptx/jszip/package/namespaces';
import { setText } from '@/pptx/jszip/text/set-text';

import { resizeTableColumns } from './resize-columns.ts';
import { resizeTableRows } from './resize-rows.ts';
import { createCellColorsSchema, tableOffsetSchema, tableRectangularDataSchema } from './schema.ts';
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
  if (!table) throw invalidTemplate('Object does not contain an <a:tbl> table');
  if (!tableOffsetSchema.safeParse(startColumn).success)
    throw invalidTemplate(
      `Table startColumn must be a non-negative integer; received ${startColumn}`,
    );
  if (cellColors !== undefined && !createCellColorsSchema(data).safeParse(cellColors).success) {
    throw invalidTemplate(
      'Table cell colors must match data dimensions and contain six-digit RGB hex colors or undefined',
    );
  }
  const rows = Array.from(table.getElementsByTagNameNS(drawing, 'tr'));
  if (resizeColumns) {
    if (!tableRectangularDataSchema.safeParse(data).success)
      throw invalidTemplate('Table resizeColumns requires non-empty data rows of equal length', {
        rowLengths: data.map((row) => row.length),
      });
    resizeTableColumns(element, table, rows, startColumn, data[0].length);
  }
  if (resizeRows) resizeTableRows(element, table, rows, startRow, data.length);
  if (!tableOffsetSchema.safeParse(startRow).success)
    throw invalidTemplate(`Table startRow must be a non-negative integer; received ${startRow}`);
  if (rows.length !== data.length + startRow)
    throw invalidTemplate(
      `Table row count mismatch: template has ${rows.length} rows, data needs ${data.length} + startRow ${startRow} = ${data.length + startRow} (set resizeRows: true to adjust)`,
      { templateRows: rows.length, dataRows: data.length, startRow },
    );
  for (const [rowIndex, row] of rows.slice(startRow).entries()) {
    const cells = Array.from(row.getElementsByTagNameNS(drawing, 'tc'));
    if (cells.length !== data[rowIndex].length + startColumn)
      throw invalidTemplate(
        `Table column count mismatch in data row ${rowIndex}: template row has ${cells.length} cells, data needs ${data[rowIndex].length} + startColumn ${startColumn} (set resizeColumns: true to adjust)`,
        { templateCells: cells.length, dataCells: data[rowIndex].length, startColumn, rowIndex },
      );
    for (const [columnIndex, cell] of cells.slice(startColumn).entries()) {
      setText(cell, String(data[rowIndex][columnIndex]));
      const color = cellColors?.[rowIndex][columnIndex];
      if (color !== undefined) setCellTextColor(cell, color);
    }
  }
}
