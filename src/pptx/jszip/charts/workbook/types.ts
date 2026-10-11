export interface WorksheetBounds {
  firstColumn: number;
  lastColumn: number;
  firstRow: number;
  lastRow: number;
}
export interface TableResizeOptions {
  categoryColumn: string;
  firstRow: number;
  lastRow: number;
  seriesNames?: string[];
}
