import type { ISlide } from 'pptx-automizer';

export type SlideModifier = (slide: ISlide) => void;

export type SlideItemModifier<T> = (
  slide: ISlide,
  item: T,
  index: number,
) => void;

export interface AutomizerCategoryChartInput {
  seriesNames?: string[];
  categories?: string[];
  data: number[][];
  colors?: (string | undefined)[];
}

export interface SetTableOptions {
  /**
   * 0-based row index where data filling begins.
   * If startRow === 1 (default), the template table's row 0 header is preserved.
   * Pass startRow: 0 to fill from the first row and overwrite template headers.
   * Default: 1.
   */
  startRow?: number;
  /**
   * Optional custom header labels to write to header row(s).
   * Can be a 1D array of labels or a 2D array for multi-row headers.
   * If omitted and startRow >= 1, existing headers are preserved from the template.
   */
  headers?: (string | number)[] | (string | number)[][];
  /**
   * Optional cell color matrix matching the data rows.
   */
  cellColors?: (string | undefined)[][];
  /**
   * Whether to adjust table height proportionally based on total row count. Default: true.
   */
  adjustHeight?: boolean;
  /**
   * Whether to adjust table width proportionally. Default: false.
   */
  adjustWidth?: boolean;
}

export interface AutomizerTableInput extends SetTableOptions {
  data: (string | number)[][];
}
