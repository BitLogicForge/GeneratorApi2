import { invalidTemplate } from '@/pptx/jszip/package/invalid-template';
import { spreadsheet } from '@/pptx/jszip/package/namespaces';

import { columnNameToNumber } from './charts/workbook/columns.ts';

import type { Document, Element } from '@xmldom/xmldom';

function findOrCreateRow(
  sheet: Document,
  data: Element,
  rowNumber: number,
): Element {
  const rows = Array.from(data.getElementsByTagNameNS(spreadsheet, 'row'));
  const existing = rows.find(
    (item) => Number(item.getAttribute('r')) === rowNumber,
  );
  if (existing) return existing;

  const row = sheet.createElementNS(spreadsheet, 'row');
  row.setAttribute('r', String(rowNumber));
  const nextRow =
    rows.find((item) => Number(item.getAttribute('r')) > rowNumber) ?? null;
  data.insertBefore(row, nextRow);
  return row;
}

function findOrCreateCell(
  sheet: Document,
  row: Element,
  address: string,
  column: string,
): Element {
  const cells = Array.from(row.getElementsByTagNameNS(spreadsheet, 'c'));
  const existing = cells.find((item) => item.getAttribute('r') === address);
  if (existing) return existing;

  const cell = sheet.createElementNS(spreadsheet, 'c');
  cell.setAttribute('r', address);

  const style = Array.from(sheet.getElementsByTagNameNS(spreadsheet, 'c'))
    .find((item) => item.getAttribute('r') === `${column}2`)
    ?.getAttribute('s');
  if (style) cell.setAttribute('s', style);

  const targetCol = columnNameToNumber(column);
  const nextCell =
    cells.find(
      (item) =>
        columnNameToNumber(item.getAttribute('r')!.replace(/\d+$/, '')) >
        targetCol,
    ) ?? null;
  row.insertBefore(cell, nextCell);
  return cell;
}

function writeCellValue(
  sheet: Document,
  cell: Element,
  value: string | number,
): void {
  while (cell.firstChild) cell.removeChild(cell.firstChild);
  if (typeof value === 'number') {
    cell.removeAttribute('t');
    const node = sheet.createElementNS(spreadsheet, 'v');
    node.textContent = String(value);
    cell.appendChild(node);
  } else {
    cell.setAttribute('t', 'inlineStr');
    const inline = sheet.createElementNS(spreadsheet, 'is');
    const text = sheet.createElementNS(spreadsheet, 't');
    text.textContent = value;
    inline.appendChild(text);
    cell.appendChild(inline);
  }
}

/** Creates missing rows/cells while retaining existing cell styles. */
export function setWorksheetCell(
  sheet: Document,
  address: string,
  value: string | number,
) {
  const match = /^([A-Z]+)(\d+)$/.exec(address);
  const data = sheet.getElementsByTagNameNS(spreadsheet, 'sheetData')[0];
  if (!match || !data) throw invalidTemplate();

  const row = findOrCreateRow(sheet, data, Number(match[2]));
  const cell = findOrCreateCell(sheet, row, address, match[1]);
  writeCellValue(sheet, cell, value);
}
