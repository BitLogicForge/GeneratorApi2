import { invalidTemplate } from '@/pptx/jszip/package/invalid-template';
import { spreadsheet } from '@/pptx/jszip/package/namespaces';

import { columnNameToNumber } from './charts/workbook/columns.ts';

import type { Document, Element } from '@xmldom/xmldom';

const CELL_ADDRESS_REGEX = /^([A-Z]+)(\d+)$/;
const NEEDS_SPACE_PRESERVE = /^\s|\s$|\s{2,}/;

/**
 * Finds an existing <row> or inserts a new one in ascending row order.
 */
function findOrCreateRow(
  sheet: Document,
  sheetData: Element,
  rowNumber: number,
): Element {
  const rows = Array.from(sheetData.getElementsByTagNameNS(spreadsheet, 'row'));

  // Single pass: rows are sorted ascending by 'r'
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

/**
 * Looks up the style attribute ('s') of a cell in a specific reference row
 * without scanning every cell in the entire worksheet.
 */
function getReferenceStyle(
  sheetData: Element,
  column: string,
  referenceRowNumber: number,
): string | null {
  const refAddress = `${column}${referenceRowNumber}`;
  const rows = Array.from(sheetData.getElementsByTagNameNS(spreadsheet, 'row'));
  const refRow = rows.find(
    (row) => Number(row.getAttribute('r')) === referenceRowNumber,
  );
  if (!refRow) return null;

  const refCell = Array.from(
    refRow.getElementsByTagNameNS(spreadsheet, 'c'),
  ).find((cell) => cell.getAttribute('r') === refAddress);

  return refCell?.getAttribute('s') || null;
}

/**
 * Finds an existing <c> cell in a row or inserts a new one in ascending column order,
 * inheriting the column's data style if available.
 */
function findOrCreateCell(
  sheet: Document,
  sheetData: Element,
  row: Element,
  address: string,
  column: string,
  styleReferenceRow = 2,
): Element {
  const cells = Array.from(row.getElementsByTagNameNS(spreadsheet, 'c'));
  const targetColIndex = columnNameToNumber(column);

  // Single pass: cells are sorted ascending by column index
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

function writeCellValue(
  sheet: Document,
  cell: Element,
  value: string | number,
): void {
  while (cell.firstChild) {
    cell.removeChild(cell.firstChild);
  }

  if (typeof value === 'number') {
    cell.removeAttribute('t');
    const vNode = sheet.createElementNS(spreadsheet, 'v');
    vNode.textContent = String(value);
    cell.appendChild(vNode);
    return;
  }

  cell.setAttribute('t', 'inlineStr');
  const isNode = sheet.createElementNS(spreadsheet, 'is');
  const tNode = sheet.createElementNS(spreadsheet, 't');

  if (NEEDS_SPACE_PRESERVE.test(value)) {
    tNode.setAttributeNS(
      'http://www.w3.org/XML/1998/namespace',
      'xml:space',
      'preserve',
    );
  }

  tNode.textContent = value;
  isNode.appendChild(tNode);
  cell.appendChild(isNode);
}

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
