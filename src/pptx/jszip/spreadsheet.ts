import { invalidTemplate } from '@/pptx/jszip/package/invalid-template';
import { spreadsheet } from '@/pptx/jszip/package/namespaces';

import type { Document } from '@xmldom/xmldom';

export const MAX_WORKSHEET_COLUMNS = 16384;
export const MAX_WORKSHEET_ROWS = 1048576;

/** Converts an Excel column name (e.g. 'A', 'Z', 'AA', 'XFD') to a 1-based column index. */
export function columnNameToNumber(column: string): number {
  if (!/^[A-Z]+$/.test(column)) throw invalidTemplate();
  let number = 0;
  for (let i = 0; i < column.length; i++) {
    number = number * 26 + column.charCodeAt(i) - 64;
  }
  if (number < 1 || number > MAX_WORKSHEET_COLUMNS) throw invalidTemplate();
  return number;
}

/** Converts a 1-based column index to an Excel column name (e.g. 1 -> 'A', 27 -> 'AA'). */
export function columnNumberToName(value: number): string {
  if (!Number.isInteger(value) || value < 1 || value > MAX_WORKSHEET_COLUMNS) {
    throw invalidTemplate();
  }
  let name = '';
  let current = value;
  while (current > 0) {
    current--;
    name = String.fromCharCode(65 + (current % 26)) + name;
    current = Math.floor(current / 26);
  }
  return name;
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
  const rowNumber = Number(match[2]);
  const rows = Array.from(data.getElementsByTagNameNS(spreadsheet, 'row'));
  let row = rows.find((item) => Number(item.getAttribute('r')) === rowNumber);
  if (!row) {
    row = sheet.createElementNS(spreadsheet, 'row');
    row.setAttribute('r', String(rowNumber));
    data.insertBefore(
      row,
      rows.find((item) => Number(item.getAttribute('r')) > rowNumber) ?? null,
    );
  }
  const cells = Array.from(row.getElementsByTagNameNS(spreadsheet, 'c'));
  let cell = cells.find((item) => item.getAttribute('r') === address);
  if (!cell) {
    cell = sheet.createElementNS(spreadsheet, 'c');
    cell.setAttribute('r', address);
    const style = Array.from(sheet.getElementsByTagNameNS(spreadsheet, 'c'))
      .find((item) => item.getAttribute('r') === `${match[1]}2`)
      ?.getAttribute('s');
    if (style) cell.setAttribute('s', style);
    row.insertBefore(
      cell,
      cells.find(
        (item) =>
          columnNameToNumber(item.getAttribute('r')!.replace(/\d+$/, '')) >
          columnNameToNumber(match[1]),
      ) ?? null,
    );
  }
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
