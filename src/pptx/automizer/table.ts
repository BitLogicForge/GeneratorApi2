import { modify } from 'pptx-automizer';

import type { TableData, TableRowStyle, XmlElement } from 'pptx-automizer';
import type { AutomizerTableInput, SetTableOptions } from './types.ts';

/**
 * Transforms 2D row/cell matrices and optional cell hex colors into
 * pptx-automizer's TableData structure for modify.setTable or modify.setTableData.
 */
export function toAutomizerTableData(
  inputOrData: (string | number)[][] | AutomizerTableInput,
  cellColors?: (string | undefined)[][],
): TableData {
  const data = Array.isArray(inputOrData) ? inputOrData : inputOrData.data;
  const colors = Array.isArray(inputOrData)
    ? cellColors
    : (inputOrData.cellColors ?? cellColors);
  return {
    body: data.map((row, rowIdx) => {
      const rowColors = colors?.[rowIdx];
      const styles =
        rowColors && rowColors.length > 0
          ? rowColors.map((hex) => {
              if (!hex) return null;
              const cleanHex = hex.replace(/^#/, '');
              return {
                color: { type: 'srgbClr', value: cleanHex },
              } as TableRowStyle;
            })
          : undefined;

      return {
        label: `row-${rowIdx}`,
        values: row,
        styles,
      };
    }),
  };
}

/**
 * Extracts direct child row elements from a table graphicFrame element.
 */
function findTableRows(tableElement: XmlElement): XmlElement[] {
  const trsByNs = tableElement.getElementsByTagNameNS(
    'http://schemas.openxmlformats.org/drawingml/2006/main',
    'tr',
  );
  if (trsByNs.length > 0) return Array.from(trsByNs) as XmlElement[];
  return Array.from(tableElement.getElementsByTagName('a:tr')) as XmlElement[];
}

/**
 * Extracts cell text values from a table row element.
 */
function extractRowValues(rowElement: XmlElement): string[] {
  const tcsByNs = rowElement.getElementsByTagNameNS(
    'http://schemas.openxmlformats.org/drawingml/2006/main',
    'tc',
  );
  const tcs = (
    tcsByNs.length > 0
      ? Array.from(tcsByNs)
      : Array.from(rowElement.getElementsByTagName('a:tc'))
  ) as XmlElement[];

  return tcs.map((tc) => {
    const tsByNs = tc.getElementsByTagNameNS(
      'http://schemas.openxmlformats.org/drawingml/2006/main',
      't',
    );
    const ts = (
      tsByNs.length > 0
        ? Array.from(tsByNs)
        : Array.from(tc.getElementsByTagName('a:t'))
    ) as XmlElement[];
    return ts.map((t) => t.textContent ?? '').join('');
  });
}

/**
 * High-level table modifier for pptx-automizer.
 * Preserves the template table's header row at row 0 by default (startRow: 1),
 * filling data rows starting from row 1, or writes from row 0 if startRow: 0.
 */
export function setTable(
  inputOrData: (string | number)[][] | AutomizerTableInput,
  options: SetTableOptions = {},
): (element: XmlElement) => void {
  const isInputObj = !Array.isArray(inputOrData);
  const data = isInputObj ? inputOrData.data : inputOrData;
  const startRow =
    isInputObj && inputOrData.startRow !== undefined
      ? inputOrData.startRow
      : (options.startRow ?? 1);
  const headers = isInputObj ? inputOrData.headers : options.headers;
  const cellColors = isInputObj ? inputOrData.cellColors : options.cellColors;
  const adjustHeight = options.adjustHeight ?? true;
  const adjustWidth = options.adjustWidth ?? false;

  return (element: XmlElement) => {
    let combinedData = data;
    let combinedColors = cellColors;

    if (startRow > 0) {
      let headerRows: (string | number)[][] | undefined = undefined;
      if (headers) {
        if (headers.length > 0 && Array.isArray(headers[0])) {
          headerRows = headers as (string | number)[][];
        } else {
          headerRows = [headers as (string | number)[]];
        }
      } else {
        const rows = findTableRows(element);
        if (rows.length > 0) {
          const count = Math.min(startRow, rows.length);
          headerRows = rows.slice(0, count).map(extractRowValues);
        }
      }

      if (headerRows && headerRows.length > 0) {
        combinedData = [...headerRows, ...data];
        const paddingColors: (string | undefined)[][] = Array.from(
          { length: headerRows.length },
          () => [],
        );
        combinedColors = cellColors
          ? [...paddingColors, ...cellColors]
          : undefined;
      }
    }

    const tableData = toAutomizerTableData(combinedData, combinedColors);
    modify.setTable(tableData, { adjustHeight, adjustWidth })(element);
  };
}
