import { invalidTemplate } from '@/pptx/jszip/package/invalid-template';
import { spreadsheet } from '@/pptx/jszip/package/namespaces';

import { readCellAddress } from './cell-address.ts';
import { MAX_WORKSHEET_ROWS } from './columns.ts';

import type { Document } from '@xmldom/xmldom';
import type { WorksheetBounds } from './types.ts';

export function readWorksheetBounds(sheet: Document): WorksheetBounds {
  const bounds = {
    firstColumn: Infinity,
    lastColumn: 0,
    firstRow: Infinity,
    lastRow: 0,
  };
  let rowNumber = 0;
  for (const rowElement of Array.from(sheet.getElementsByTagNameNS(spreadsheet, 'row'))) {
    rowNumber = Number(rowElement.getAttribute('r') || rowNumber + 1);
    if (!Number.isInteger(rowNumber) || rowNumber < 1 || rowNumber > MAX_WORKSHEET_ROWS)
      throw invalidTemplate(
        `Chart worksheet row number "${rowElement.getAttribute('r')}" is out of range 1..${MAX_WORKSHEET_ROWS}`,
      );
    let column = 0;
    for (const cell of Array.from(rowElement.getElementsByTagNameNS(spreadsheet, 'c'))) {
      const address = readCellAddress(cell, column, rowNumber);
      column = address.column;
      bounds.firstColumn = Math.min(bounds.firstColumn, column);
      bounds.lastColumn = Math.max(bounds.lastColumn, column);
      bounds.firstRow = Math.min(bounds.firstRow, address.row);
      bounds.lastRow = Math.max(bounds.lastRow, address.row);
    }
  }
  return bounds;
}
