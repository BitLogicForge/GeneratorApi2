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

export interface AutomizerTableInput {
  data: (string | number)[][];
  cellColors?: (string | undefined)[][];
}
