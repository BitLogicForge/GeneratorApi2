import { invalidTemplate } from '@/pptx/jszip/package/invalid-template';
import { spreadsheet } from '@/pptx/jszip/package/namespaces';

import { columnNameToNumber, columnNumberToName } from './workbook/columns.ts';

import type { Document, Element } from '@xmldom/xmldom';

export function createChartRange(
  sheet: Document,
  sheetName: string,
  firstColumn: string,
  firstRow: number,
  rowCount: number,
) {
  const lastRow = firstRow + rowCount - 1;
  if (!Number.isInteger(firstRow) || firstRow < 2) throw invalidTemplate();
  const columnNumber = columnNameToNumber(firstColumn);
  const categoryColumn = columnNumberToName(columnNumber - 1);
  const resizeFormula = (formula: Element | undefined, column: string) => {
    if (!formula) throw invalidTemplate();
    const prefix = [sheetName, `'${sheetName.replaceAll("'", "''")}'`]
      .map((name) => `${name}!$${column}$${firstRow}:$${column}$`)
      .find((value) => formula.textContent?.startsWith(value));
    if (!prefix) throw invalidTemplate();
    const oldLastRow = Number(formula.textContent!.slice(prefix.length));
    if (!Number.isInteger(oldLastRow) || oldLastRow < firstRow)
      throw invalidTemplate();
    // Remove obsolete data only inside this chart's old range; leave other worksheet data alone.
    for (let row = lastRow + 1; row <= oldLastRow; row++) {
      const cell = Array.from(
        sheet.getElementsByTagNameNS(spreadsheet, 'c'),
      ).find((node) => node.getAttribute('r') === `${column}${row}`);
      if (cell) cell.parentNode!.removeChild(cell);
    }
    formula.textContent = `${prefix}${lastRow}`;
  };
  return {
    lastRow,
    categoryColumn,
    columnNumber,
    columnName: columnNumberToName,
    resizeFormula,
  };
}
