export interface FillTableOptions {
  startRow?: number;
  /** Zero-based first data column; preceding columns are preserved. */
  startColumn?: number;
  resizeRows?: boolean;
  resizeColumns?: boolean;
  /** Text colors aligned with data rows/columns; undefined preserves template color. */
  cellColors?: (string | undefined)[][];
}
