export interface CategoryChartOptions {
  sheetName?: string;
  firstColumn?: string;
  firstRow?: number;
  categories?: (string | number)[];
  seriesNames?: string[];
  /** One six-digit RGB hex color per data row, applied across all series. */
  colors?: string[];
}
