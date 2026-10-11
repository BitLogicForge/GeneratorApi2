import type { Document } from '@xmldom/xmldom';
import { spreadsheet } from '@/pptx/jszip/package/namespaces';
import { invalidTemplate } from '@/pptx/jszip/package/invalid-template';

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
    const columnOrder = (column: string) =>
      Array.from(column).reduce(
        (number, letter) => number * 26 + letter.charCodeAt(0) - 64,
        0,
      );
    row.insertBefore(
      cell,
      cells.find(
        (item) =>
          columnOrder(item.getAttribute('r')!.replace(/\d+$/, '')) >
          columnOrder(match[1]),
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
