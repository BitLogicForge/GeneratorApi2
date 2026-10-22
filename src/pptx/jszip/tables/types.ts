export interface FillTableOptions {
  /** Zero-based first data row; preceding header rows are preserved. */
  startRow?: number;
  /** Zero-based first data column; preceding columns are preserved. */
  startColumn?: number;
  /** Clones or removes data rows from `startRow` to match `data.length`. */
  resizeRows?: boolean;
  /** Clones or removes data columns from `startColumn` to match `data[0].length`. */
  resizeColumns?: boolean;
  /** Text colors aligned with data rows/columns; undefined preserves template color. */
  cellColors?: (string | undefined)[][];
}
