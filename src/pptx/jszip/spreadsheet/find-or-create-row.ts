import { spreadsheet } from '@/pptx/jszip/package/namespaces';

import type { Document, Element } from '@xmldom/xmldom';

/** Finds an existing `<row>` or inserts a new one in ascending row order. */
export function findOrCreateRow(
  sheet: Document,
  sheetData: Element,
  rowNumber: number,
): Element {
  const rows = Array.from(sheetData.getElementsByTagNameNS(spreadsheet, 'row'));
  const matchOrNext = rows.find(
    (row) => Number(row.getAttribute('r')) >= rowNumber,
  );
  if (matchOrNext && Number(matchOrNext.getAttribute('r')) === rowNumber) {
    return matchOrNext;
  }
  const newRow = sheet.createElementNS(spreadsheet, 'row');
  newRow.setAttribute('r', String(rowNumber));
  sheetData.insertBefore(newRow, matchOrNext ?? null);
  return newRow;
}
