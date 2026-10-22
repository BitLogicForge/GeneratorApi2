export interface CategoryChartOptions {
  /** Target worksheet name in the embedded chart workbook (defaults to `'Sheet1'`). */
  sheetName?: string;
  /** Excel column letter for the first series values (defaults to `'B'`; category column is the preceding column). */
  firstColumn?: string;
  /** 1-based Excel row index for the first data point (defaults to `2`, below the header row). */
  firstRow?: number;
  /** Category labels, numbers, or ISO `YYYY-MM-DD` dates aligned with data rows. */
  categories?: (string | number)[];
  /** Optional series header names written to the row above `firstRow` and synced to Excel table columns. */
  seriesNames?: string[];
  /** One six-digit RGB hex color per data row, applied across all series. */
  colors?: string[];
}
