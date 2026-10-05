import JSZip from 'jszip';
import type { NamedObject } from './objects.js';
import type { Element } from '@xmldom/xmldom';
import { setWorksheetCell } from './spreadsheet.js';
import {
  chartNs,
  spreadsheet,
  relationshipNs,
  readXml,
  writeXml,
  resolveRelationship,
} from './package.js';

interface LineChartOptions {
  sheetName?: string;
  firstColumn?: string;
  firstRow?: number;
  categories?: string[];
}

function fillCache(cache: Element, values: (string | number)[]) {
  const document = cache.ownerDocument!;
  const count = cache.getElementsByTagNameNS(chartNs, 'ptCount')[0];
  count.setAttribute('val', String(values.length));
  for (const point of Array.from(cache.getElementsByTagNameNS(chartNs, 'pt')))
    cache.removeChild(point);
  const extension = cache.getElementsByTagNameNS(chartNs, 'extLst')[0];
  for (const [index, value] of values.entries()) {
    const point = document.createElementNS(chartNs, 'c:pt');
    point.setAttribute('idx', String(index));
    const node = document.createElementNS(chartNs, 'c:v');
    node.textContent = String(value);
    point.appendChild(node);
    cache.insertBefore(point, extension ?? null);
  }
}

/** Resizes chart caches, formulas and workbook data; retains series names and styling. */
export async function fillLineChart(
  zip: JSZip,
  chartObject: NamedObject,
  data: number[][],
  {
    sheetName = 'Sheet1',
    firstColumn = 'B',
    firstRow = 2,
    categories,
  }: LineChartOptions = {},
) {
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
  const lineChart = chart.getElementsByTagNameNS(chartNs, 'lineChart')[0];
  const series = Array.from(lineChart.getElementsByTagNameNS(chartNs, 'ser'));
  const externalData = chart.getElementsByTagNameNS(chartNs, 'externalData')[0];
  const workbookPath = await resolveRelationship(
    zip,
    chartPath,
    externalData?.getAttributeNS(relationshipNs, 'id') ?? null,
    'package',
  );
  const embedded = zip.file(workbookPath);
  const workbook = await JSZip.loadAsync(await embedded!.async('nodebuffer'));
  const workbookDocument = await readXml(workbook, 'xl/workbook.xml');
  const sheetReference = Array.from(
    workbookDocument.getElementsByTagNameNS(spreadsheet, 'sheet'),
  ).find((item) => item.getAttribute('name') === sheetName);
  const sheetPath = await resolveRelationship(
    workbook,
    'xl/workbook.xml',
    sheetReference?.getAttributeNS(relationshipNs, 'id') ?? null,
    'worksheet',
  );
  const sheet = await readXml(workbook, sheetPath);
  const lastRow = firstRow + data.length - 1;
  const categoryColumn = String.fromCharCode(firstColumn.charCodeAt(0) - 1);
  for (const [seriesIndex, item] of series.entries()) {
    const column = String.fromCharCode(firstColumn.charCodeAt(0) + seriesIndex);
    const values = item.getElementsByTagNameNS(chartNs, 'val')[0];
    const formula = values?.getElementsByTagNameNS(chartNs, 'f')[0];
    const cache = values?.getElementsByTagNameNS(chartNs, 'numCache')[0];
    formula.textContent = `${sheetName}!$${column}$${firstRow}:$${column}$${lastRow}`;
    fillCache(
      cache,
      data.map((row) => row[seriesIndex]),
    );
    const category = item.getElementsByTagNameNS(chartNs, 'cat')[0];
    const categoryCache = category?.getElementsByTagNameNS(
      chartNs,
      'strCache',
    )[0];
    const categoryFormula = category?.getElementsByTagNameNS(chartNs, 'f')[0];
    const labels =
      categories ??
      Array.from(categoryCache.getElementsByTagNameNS(chartNs, 'v')).map(
        (node) => node.textContent ?? '',
      );
    categoryFormula.textContent = `${sheetName}!$${categoryColumn}$${firstRow}:$${categoryColumn}$${lastRow}`;
    fillCache(categoryCache, labels);
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
  const dimension = sheet.getElementsByTagNameNS(spreadsheet, 'dimension')[0];
  if (dimension)
    dimension.setAttribute(
      'ref',
      dimension.getAttribute('ref')!.replace(/\d+$/, String(lastRow)),
    );
  for (const tablePart of Array.from(
    sheet.getElementsByTagNameNS(spreadsheet, 'tablePart'),
  )) {
    const tablePath = await resolveRelationship(
      workbook,
      sheetPath,
      tablePart.getAttributeNS(relationshipNs, 'id'),
      'table',
    );
    const table = await readXml(workbook, tablePath);
    const root = table.documentElement!;
    const range = root.getAttribute('ref');
    if (!range?.startsWith(`${categoryColumn}${firstRow - 1}:`)) continue;
    const resized = range.replace(/\d+$/, String(lastRow));
    root.setAttribute('ref', resized);
    for (const filter of Array.from(
      root.getElementsByTagNameNS(spreadsheet, 'autoFilter'),
    ))
      filter.setAttribute('ref', resized);
    writeXml(workbook, tablePath, table);
  }
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
