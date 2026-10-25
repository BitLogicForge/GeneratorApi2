import { loadChartWorkbook } from '@/pptx/jszip/charts/load-workbook';
import { resizeWorkbookTables } from '@/pptx/jszip/charts/resize-workbook-tables';
import { RelationshipType } from '@/pptx/jszip/package/constants';
import { invalidTemplate } from '@/pptx/jszip/package/invalid-template';
import { chartNs, relationshipNs } from '@/pptx/jszip/package/namespaces';
import { readXml } from '@/pptx/jszip/package/read-xml';
import { resolveRelationship } from '@/pptx/jszip/package/resolve-relationship';
import { writeXml } from '@/pptx/jszip/package/write-xml';

import { createChartRange } from './charts/ranges.ts';
import { validateCategoryChartInput } from './charts/schema.ts';
import { fillChartSeries } from './charts/series.ts';

import type { Document, Element } from '@xmldom/xmldom';
import type JSZip from 'jszip';
import type { CategoryChartOptions } from './charts/types.ts';
import type { NamedObject } from './objects.ts';

export const SUPPORTED_CHART_TYPES = new Set([
  'lineChart',
  'barChart',
  'areaChart',
  'pieChart',
  'doughnutChart',
  'radarChart',
]);

/**
 * Extracts and validates the single supported category chart plot element
 * from the chart XML document.
 */
function getSingleCategoryPlot(chartDoc: Document): Element {
  const plotArea = chartDoc.getElementsByTagNameNS(chartNs, 'plotArea')[0];
  if (!plotArea) {
    throw invalidTemplate('Chart XML is missing a <c:plotArea> element');
  }

  const chartNodes = Array.from(plotArea.childNodes).filter(
    (node): node is Element =>
      node.nodeType === 1 &&
      node.namespaceURI === chartNs &&
      Boolean(node.localName?.endsWith('Chart')),
  );

  if (chartNodes.length !== 1 || !SUPPORTED_CHART_TYPES.has(chartNodes[0].localName ?? '')) {
    throw invalidTemplate('Expected exactly one supported category chart in <c:plotArea>');
  }

  return chartNodes[0];
}

/** Resizes chart caches, formulas and workbook data; retains series names and styling. */
export async function fillCategoryChart(
  zip: JSZip,
  chartObject: NamedObject,
  data: number[][],
  userOptions: CategoryChartOptions = {},
): Promise<void> {
  const { sheetName = 'Sheet1', firstColumn = 'B', firstRow = 2, seriesNames } = userOptions;
  const options = { ...userOptions, sheetName, firstColumn, firstRow };

  const validation = validateCategoryChartInput(data, options);
  if (!validation.valid) {
    throw invalidTemplate(validation.reason, { slidePath: chartObject.path });
  }

  const chartReference = chartObject.element.getElementsByTagNameNS(chartNs, 'chart')[0];
  const relId = chartReference?.getAttributeNS(relationshipNs, 'id') ?? null;
  const chartPath = await resolveRelationship(zip, chartObject.path, relId, RelationshipType.Chart);
  const chart = await readXml(zip, chartPath);

  const plot = getSingleCategoryPlot(chart);
  const series = Array.from(plot.getElementsByTagNameNS(chartNs, 'ser'));
  if (series.length !== data[0]?.length) {
    throw invalidTemplate(
      `Series count mismatch: template has ${series.length}, data has ${data[0]?.length ?? 0}`,
      { slidePath: chartObject.path, chartPath },
    );
  }

  const { workbook, workbookPath, sheet, sheetPath, date1904 } = await loadChartWorkbook(
    zip,
    chart,
    chartPath,
    sheetName,
  );

  const range = createChartRange(sheet, sheetName, firstColumn, firstRow, data.length);

  fillChartSeries(sheet, series, data, { ...options, date1904 }, range);

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

  const workbookBuffer = await workbook.generateAsync({
    type: 'uint8array',
    compression: 'DEFLATE',
  });
  zip.file(workbookPath, workbookBuffer, { createFolders: false });
}
