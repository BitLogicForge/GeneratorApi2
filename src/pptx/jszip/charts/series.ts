import { invalidTemplate } from '@/pptx/jszip/package/invalid-template';
import { chartNs } from '@/pptx/jszip/package/namespaces';
import { setWorksheetCell } from '@/pptx/jszip/spreadsheet';

import { fillCache } from './cache.ts';

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
  }: Required<Pick<CategoryChartOptions, 'sheetName' | 'firstRow'>> &
    CategoryChartOptions,
  {
    categoryColumn,
    columnNumber,
    columnName,
    resizeFormula,
  }: ReturnType<typeof createChartRange>,
) {
  for (const [seriesIndex, item] of series.entries()) {
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
    const category = item.getElementsByTagNameNS(chartNs, 'cat')[0];
    const categoryCache =
      category?.getElementsByTagNameNS(chartNs, 'strCache')[0] ??
      category?.getElementsByTagNameNS(chartNs, 'multiLvlStrCache')[0];
    const categoryFormula = category?.getElementsByTagNameNS(chartNs, 'f')[0];
    if (
      !categoryCache ||
      categoryCache.getElementsByTagNameNS(chartNs, 'lvl').length > 1
    )
      throw invalidTemplate();
    const labels =
      categories ??
      Array.from(categoryCache.getElementsByTagNameNS(chartNs, 'v')).map(
        (node) => node.textContent ?? '',
      );
    if (labels.length !== data.length) throw invalidTemplate();
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
