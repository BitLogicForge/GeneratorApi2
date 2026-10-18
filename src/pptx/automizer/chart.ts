import type { ChartCategory, ChartData, ChartSeries } from 'pptx-automizer';
import type { AutomizerCategoryChartInput } from './types.ts';

/**
 * Transforms category names, series values, and optional hex colors into
 * pptx-automizer's ChartData structure for modify.setChartData.
 */
export function toAutomizerChartData(
  input: AutomizerCategoryChartInput,
): ChartData {
  const seriesCount = input.data[0]?.length ?? 0;
  const series: ChartSeries[] = Array.from(
    { length: seriesCount },
    (_, idx) => ({
      label: input.seriesNames?.[idx] ?? `Series ${idx + 1}`,
    }),
  );

  const rowCount = Math.max(input.data.length, input.categories?.length ?? 0);
  const categories: ChartCategory[] = Array.from(
    { length: rowCount },
    (_, catIdx) => {
      const catLabel = input.categories?.[catIdx] ?? `Category ${catIdx + 1}`;
      const rowValues = input.data[catIdx] ?? [];
      const hexColor = input.colors?.[catIdx]?.replace(/^#/, '');
      return {
        label: catLabel,
        values: rowValues,
        styles: hexColor
          ? [{ color: { type: 'srgbClr', value: hexColor } }]
          : undefined,
      };
    },
  );

  return { series, categories };
}
