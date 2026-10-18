import { invalidTemplate } from '@/pptx/jszip/package/invalid-template';
import { chartNs } from '@/pptx/jszip/package/namespaces';
import { setWorksheetCell } from '@/pptx/jszip/spreadsheet';

import { fillCache } from './cache.ts';
import { resolveSeriesCategories } from './categories.ts';
import { fillPointColors } from './point-colors.ts';

import type { Document, Element } from '@xmldom/xmldom';
import type { createChartRange } from './ranges.ts';
import type { CategoryChartOptions } from './types.ts';

export function fillChartSeries(
  sheet: Document,
  series: Element[],
  data: number[][],
  {
    sheetName,
    firstRow,
    categories,
    seriesNames,
    colors,
    date1904 = false,
  }: Required<Pick<CategoryChartOptions, 'sheetName' | 'firstRow'>> &
    CategoryChartOptions & { date1904?: boolean },
  {
    categoryColumn,
    columnNumber,
    columnName,
    resizeFormula,
  }: ReturnType<typeof createChartRange>,
) {
  for (const [seriesIndex, item] of series.entries()) {
    if (colors) fillPointColors(item, colors);
    const column = columnName(columnNumber + seriesIndex);
    const values = item.getElementsByTagNameNS(chartNs, 'val')[0];
    const formula = values?.getElementsByTagNameNS(chartNs, 'f')[0];
    const cache = values?.getElementsByTagNameNS(chartNs, 'numCache')[0];
    if (!cache) throw invalidTemplate();
    resizeFormula(formula, column);
    fillCache(
      cache,
      data.map((row) => row[seriesIndex]),
    );
    const { categoryCache, categoryFormula, labels } = resolveSeriesCategories(
      item,
      categories,
      data.length,
      date1904,
    );
    resizeFormula(categoryFormula, categoryColumn);
    fillCache(categoryCache, labels);
    if (seriesNames) {
      const title = item.getElementsByTagNameNS(chartNs, 'tx')[0];
      const titleCache = title?.getElementsByTagNameNS(chartNs, 'strCache')[0];
      const titleFormula = title?.getElementsByTagNameNS(chartNs, 'f')[0];
      const expected = [sheetName, `'${sheetName.replaceAll("'", "''")}'`].map(
        (name) => `${name}!$${column}$${firstRow - 1}`,
      );
      if (!titleCache || !expected.includes(titleFormula?.textContent ?? ''))
        throw invalidTemplate();
      fillCache(titleCache, [seriesNames[seriesIndex]]);
      setWorksheetCell(
        sheet,
        `${column}${firstRow - 1}`,
        seriesNames[seriesIndex],
      );
    }
    for (const [index, row] of data.entries()) {
      setWorksheetCell(sheet, `${column}${index + firstRow}`, row[seriesIndex]);
      if (seriesIndex === 0)
        setWorksheetCell(
          sheet,
          `${categoryColumn}${index + firstRow}`,
          labels[index],
        );
    }
  }
}
