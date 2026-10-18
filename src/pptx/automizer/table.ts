import type { TableData, TableRowStyle } from 'pptx-automizer';
import type { AutomizerTableInput } from './types.ts';

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
      const styles = rowColors
        ? rowColors.map((hex) => {
            if (!hex) return null;
            const cleanHex = hex.replace(/^#/, '');
            return <TableRowStyle>{
              color: { type: 'srgbClr', value: cleanHex },
            };
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
