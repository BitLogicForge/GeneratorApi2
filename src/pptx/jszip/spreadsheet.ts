import { invalidTemplate } from '@/pptx/jszip/package/invalid-template';
import { spreadsheet } from '@/pptx/jszip/package/namespaces';

import { findOrCreateCell } from './spreadsheet/find-or-create-cell.ts';
import { findOrCreateRow } from './spreadsheet/find-or-create-row.ts';
import { writeCellValue } from './spreadsheet/write-cell-value.ts';

import type { Document } from '@xmldom/xmldom';

const CELL_ADDRESS_REGEX = /^([A-Z]+)(\d+)$/;

/** Creates missing rows/cells while retaining existing cell styles. */
export function setWorksheetCell(
  sheet: Document,
  address: string,
  value: string | number,
  styleReferenceRow = 2,
): void {
  if (typeof value === 'number' && !Number.isFinite(value)) {
    throw invalidTemplate(`Invalid numeric cell value: ${value}`);
  }
  const match = CELL_ADDRESS_REGEX.exec(address);
  const sheetData = sheet.getElementsByTagNameNS(spreadsheet, 'sheetData')[0];
  if (!match || !sheetData) {
    throw invalidTemplate(
      `Invalid cell address "${address}" or missing <sheetData>`,
    );
  }
  const [, column, rowStr] = match;
  const row = findOrCreateRow(sheet, sheetData, Number(rowStr));
  const cell = findOrCreateCell(
    sheet,
    sheetData,
    row,
    address,
    column,
    styleReferenceRow,
  );
  writeCellValue(sheet, cell, value);
}
