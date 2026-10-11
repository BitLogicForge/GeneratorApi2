import JSZip from 'jszip';

import { invalidTemplate } from '@/pptx/jszip/package/invalid-template';
import { relationshipNs, spreadsheet } from '@/pptx/jszip/package/namespaces';
import { readXml } from '@/pptx/jszip/package/read-xml';
import { resolveRelationship } from '@/pptx/jszip/package/resolve-relationship';
import { writeXml } from '@/pptx/jszip/package/write-xml';

import type { Document, Element } from '@xmldom/xmldom';

interface WorksheetBounds {
  firstColumn: number;
  lastColumn: number;
  firstRow: number;
  lastRow: number;
}
interface TableResizeOptions {
  categoryColumn: string;
  firstRow: number;
  lastRow: number;
  seriesNames?: string[];
}

function readCellAddress(
  cell: Element,
  previousColumn: number,
  rowNumber: number,
) {
  const reference = cell.getAttribute('r');
  const address = reference ? /^([A-Z]+)([1-9]\d*)$/.exec(reference) : null;
  if (reference && !address) throw invalidTemplate();
  const column = address
    ? Array.from(address[1]).reduce(
        (number, letter) => number * 26 + letter.charCodeAt(0) - 64,
        0,
      )
    : previousColumn + 1;
  const row = address ? Number(address[2]) : rowNumber;
  if (column > 16384 || row > 1048576) throw invalidTemplate();
  return { column, row };
}

function readWorksheetBounds(sheet: Document): WorksheetBounds {
  const bounds = {
    firstColumn: Infinity,
    lastColumn: 0,
    firstRow: Infinity,
    lastRow: 0,
  };
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

function columnName(value: number): string {
  let name = '';
  while (value) {
    value--;
    name = String.fromCharCode(65 + (value % 26)) + name;
    value = Math.floor(value / 26);
  }
  return name;
}

function updateWorksheetDimension(dimension: Element, bounds: WorksheetBounds) {
  const start = bounds.lastColumn
    ? `${columnName(bounds.firstColumn)}${bounds.firstRow}`
    : 'A1';
  const end = bounds.lastColumn
    ? `${columnName(bounds.lastColumn)}${bounds.lastRow}`
    : 'A1';
  dimension.setAttribute('ref', start === end ? start : `${start}:${end}`);
}

function renameTableColumns(table: Element, seriesNames: string[]) {
  const columns = Array.from(
    table.getElementsByTagNameNS(spreadsheet, 'tableColumn'),
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

function resizeWorkbookTable(
  table: Document,
  { categoryColumn, firstRow, lastRow, seriesNames }: TableResizeOptions,
): boolean {
  const root = table.documentElement!;
  const range = root.getAttribute('ref');
  if (!range?.startsWith(`${categoryColumn}${firstRow - 1}:`)) return false;
  const resized = range.replace(/\d+$/, String(lastRow));
  root.setAttribute('ref', resized);
  if (seriesNames) renameTableColumns(root, seriesNames);
  for (const filter of Array.from(
    root.getElementsByTagNameNS(spreadsheet, 'autoFilter'),
  ))
    filter.setAttribute('ref', resized);
  return true;
}

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
  if (dimension)
    updateWorksheetDimension(dimension, readWorksheetBounds(sheet));
  const options = { categoryColumn, firstRow, lastRow, seriesNames };
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
    if (resizeWorkbookTable(table, options))
      writeXml(workbook, tablePath, table);
  }
}
