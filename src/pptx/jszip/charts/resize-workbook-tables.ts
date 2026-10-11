import JSZip from 'jszip';

import { invalidTemplate } from '@/pptx/jszip/package/invalid-template';
import { relationshipNs, spreadsheet } from '@/pptx/jszip/package/namespaces';
import { readXml } from '@/pptx/jszip/package/read-xml';
import { resolveRelationship } from '@/pptx/jszip/package/resolve-relationship';
import { writeXml } from '@/pptx/jszip/package/write-xml';

import type { Document } from '@xmldom/xmldom';

export async function resizeWorkbookTables(
  workbook: JSZip,
  sheet: Document,
  sheetPath: string,
  categoryColumn: string,
  firstRow: number,
  lastRow: number,
  seriesNames?: string[],
) {
  const dimension = sheet.getElementsByTagNameNS(spreadsheet, 'dimension')[0];
  if (dimension) {
    let firstUsedColumn = Infinity;
    let lastUsedColumn = 0;
    let firstUsedRow = Infinity;
    let lastUsedRow = 0;
    let rowNumber = 0;
    for (const rowElement of Array.from(
      sheet.getElementsByTagNameNS(spreadsheet, 'row'),
    )) {
      rowNumber = Number(rowElement.getAttribute('r') || rowNumber + 1);
      if (!Number.isInteger(rowNumber) || rowNumber < 1 || rowNumber > 1048576)
        throw invalidTemplate();
      let column = 0;
      for (const cell of Array.from(
        rowElement.getElementsByTagNameNS(spreadsheet, 'c'),
      )) {
        const reference = cell.getAttribute('r');
        const address = reference
          ? /^([A-Z]+)([1-9]\d*)$/.exec(reference)
          : null;
        if (reference && !address) throw invalidTemplate();
        column = address
          ? Array.from(address[1]).reduce(
              (number, letter) => number * 26 + letter.charCodeAt(0) - 64,
              0,
            )
          : column + 1;
        const row = address ? Number(address[2]) : rowNumber;
        if (column > 16384 || row > 1048576) throw invalidTemplate();
        firstUsedColumn = Math.min(firstUsedColumn, column);
        lastUsedColumn = Math.max(lastUsedColumn, column);
        firstUsedRow = Math.min(firstUsedRow, row);
        lastUsedRow = Math.max(lastUsedRow, row);
      }
    }
    const columnName = (value: number) => {
      let name = '';
      while (value) {
        value--;
        name = String.fromCharCode(65 + (value % 26)) + name;
        value = Math.floor(value / 26);
      }
      return name;
    };
    const start = lastUsedColumn
      ? `${columnName(firstUsedColumn)}${firstUsedRow}`
      : 'A1';
    const end = lastUsedColumn
      ? `${columnName(lastUsedColumn)}${lastUsedRow}`
      : 'A1';
    dimension.setAttribute('ref', start === end ? start : `${start}:${end}`);
  }
  for (const tablePart of Array.from(
    sheet.getElementsByTagNameNS(spreadsheet, 'tablePart'),
  )) {
    const tablePath = await resolveRelationship(
      workbook,
      sheetPath,
      tablePart.getAttributeNS(relationshipNs, 'id'),
      'table',
    );
    const table = await readXml(workbook, tablePath);
    const root = table.documentElement!;
    const range = root.getAttribute('ref');
    if (!range?.startsWith(`${categoryColumn}${firstRow - 1}:`)) continue;
    const resized = range.replace(/\d+$/, String(lastRow));
    root.setAttribute('ref', resized);
    if (seriesNames) {
      const columns = Array.from(
        root.getElementsByTagNameNS(spreadsheet, 'tableColumn'),
      );
      if (
        columns.length !== seriesNames.length + 1 ||
        new Set([columns[0].getAttribute('name'), ...seriesNames]).size !==
          columns.length ||
        seriesNames.some((name) => !name)
      )
        throw invalidTemplate();
      for (const [index, name] of seriesNames.entries())
        columns[index + 1].setAttribute('name', name);
    }
    for (const filter of Array.from(
      root.getElementsByTagNameNS(spreadsheet, 'autoFilter'),
    ))
      filter.setAttribute('ref', resized);
    writeXml(workbook, tablePath, table);
  }
}
