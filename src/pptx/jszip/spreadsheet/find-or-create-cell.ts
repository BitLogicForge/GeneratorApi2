import { columnNameToNumber } from '@/pptx/jszip/charts/workbook/columns';
import { spreadsheet } from '@/pptx/jszip/package/namespaces';

import type { Document, Element } from '@xmldom/xmldom';

function getReferenceStyle(
  sheetData: Element,
  column: string,
  referenceRowNumber: number,
): string | null {
  const refAddress = `${column}${referenceRowNumber}`;
  const rows = Array.from(sheetData.getElementsByTagNameNS(spreadsheet, 'row'));
  const refRow = rows.find((row) => Number(row.getAttribute('r')) === referenceRowNumber);
  if (!refRow) return null;
  const refCell = Array.from(refRow.getElementsByTagNameNS(spreadsheet, 'c')).find(
    (cell) => cell.getAttribute('r') === refAddress,
  );
  return refCell?.getAttribute('s') || null;
}

/** Finds an existing `<c>` cell or inserts a new one in column order, inheriting the reference row style. */
export function findOrCreateCell(
  sheet: Document,
  sheetData: Element,
  row: Element,
  address: string,
  column: string,
  styleReferenceRow = 2,
): Element {
  const cells = Array.from(row.getElementsByTagNameNS(spreadsheet, 'c'));
  const targetColIndex = columnNameToNumber(column);
  const matchOrNext = cells.find((item) => {
    const ref = item.getAttribute('r');
    if (!ref) return false;
    const colName = ref.replace(/\d+$/, '');
    return columnNameToNumber(colName) >= targetColIndex;
  });
  if (matchOrNext?.getAttribute('r') === address) {
    return matchOrNext;
  }
  const cell = sheet.createElementNS(spreadsheet, 'c');
  cell.setAttribute('r', address);
  const style = getReferenceStyle(sheetData, column, styleReferenceRow);
  if (style) {
    cell.setAttribute('s', style);
  }
  row.insertBefore(cell, matchOrNext ?? null);
  return cell;
}
