import { loadChartWorkbook } from '@/pptx/jszip/charts/load-workbook';
import { resizeWorkbookTables } from '@/pptx/jszip/charts/resize-workbook-tables';
import { invalidTemplate } from '@/pptx/jszip/package/invalid-template';
import { chartNs, relationshipNs } from '@/pptx/jszip/package/namespaces';
import { readXml } from '@/pptx/jszip/package/read-xml';
import { resolveRelationship } from '@/pptx/jszip/package/resolve-relationship';
import { writeXml } from '@/pptx/jszip/package/write-xml';

import { createChartRange } from './charts/ranges.ts';
import { fillChartSeries } from './charts/series.ts';

import type JSZip from 'jszip';
import type { CategoryChartOptions } from './charts/types.ts';
import type { NamedObject } from './objects.ts';

/** Resizes chart caches, formulas and workbook data; retains series names and styling. */
export async function fillCategoryChart(
  zip: JSZip,
  chartObject: NamedObject,
  data: number[][],
  {
    sheetName = 'Sheet1',
    firstColumn = 'B',
    firstRow = 2,
    categories,
    seriesNames,
  }: CategoryChartOptions = {},
) {
  if (
    !data.length ||
    !data[0].length ||
    data.some(
      (row) =>
        row.length !== data[0].length ||
        row.some((value) => !Number.isFinite(value)),
    )
  )
    throw invalidTemplate();
  if (categories && categories.length !== data.length) throw invalidTemplate();
  if (seriesNames && seriesNames.length !== data[0].length)
    throw invalidTemplate();
  const chartReference = chartObject.element.getElementsByTagNameNS(
    chartNs,
    'chart',
  )[0];
  const chartPath = await resolveRelationship(
    zip,
    chartObject.path,
    chartReference?.getAttributeNS(relationshipNs, 'id') ?? null,
    'chart',
  );
  const chart = await readXml(zip, chartPath);
  const plots = [
    'lineChart',
    'barChart',
    'areaChart',
    'pieChart',
    'doughnutChart',
    'radarChart',
  ].flatMap((tag) => Array.from(chart.getElementsByTagNameNS(chartNs, tag)));
  if (plots.length !== 1) throw invalidTemplate();
  const plotArea = chart.getElementsByTagNameNS(chartNs, 'plotArea')[0];
  if (
    !plotArea ||
    Array.from(plotArea.childNodes).filter(
      (node) => node.nodeType === 1 && node.localName?.endsWith('Chart'),
    ).length !== 1
  )
    throw invalidTemplate();
  const series = Array.from(plots[0].getElementsByTagNameNS(chartNs, 'ser'));
  if (series.length !== data[0].length) throw invalidTemplate();
  const { workbook, workbookPath, sheet, sheetPath, date1904 } =
    await loadChartWorkbook(zip, chart, chartPath, sheetName);
  const range = createChartRange(
    sheet,
    sheetName,
    firstColumn,
    firstRow,
    data.length,
  );
  fillChartSeries(
    sheet,
    series,
    data,
    { sheetName, firstRow, categories, seriesNames, date1904 },
    range,
  );
  await resizeWorkbookTables(
    workbook,
    sheet,
    sheetPath,
    range.categoryColumn,
    firstRow,
    range.lastRow,
    seriesNames,
  );
  writeXml(zip, chartPath, chart);
  writeXml(workbook, sheetPath, sheet);
  zip.file(
    workbookPath,
    await workbook.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
    }),
    { createFolders: false },
  );
}
