export interface FillTableOptions {
  startRow?: number;
  /** Zero-based first data column; preceding columns are preserved. */
  startColumn?: number;
  resizeRows?: boolean;
  resizeColumns?: boolean;
}
