import JSZip from 'jszip';
import type { NamedObject } from './objects.ts';
import type { Element } from '@xmldom/xmldom';
import { setWorksheetCell } from './spreadsheet.ts';
import {
  chartNs,
  spreadsheet,
  relationshipNs,
  readXml,
  writeXml,
  resolveRelationship,
  invalidTemplate,
} from './package.ts';

interface CategoryChartOptions {
  sheetName?: string;
  firstColumn?: string;
  firstRow?: number;
  categories?: string[];
  seriesNames?: string[];
}

function fillCache(cache: Element, values: (string | number)[]) {
  const document = cache.ownerDocument!;
  const count = cache.getElementsByTagNameNS(chartNs, 'ptCount')[0];
  if (!count) throw invalidTemplate();
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
  const externalData = chart.getElementsByTagNameNS(chartNs, 'externalData')[0];
  const workbookPath = await resolveRelationship(
    zip,
    chartPath,
    externalData?.getAttributeNS(relationshipNs, 'id') ?? null,
    'package',
  );
  const embedded = zip.file(workbookPath);
  if (!embedded) throw invalidTemplate();
  const workbook = await JSZip.loadAsync(await embedded.async('nodebuffer'));
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
  if (
    !/^[A-Z]+$/.test(firstColumn) ||
    !Number.isInteger(firstRow) ||
    firstRow < 2
  )
    throw invalidTemplate();
  const columnNumber = Array.from(firstColumn).reduce(
    (total, letter) => total * 26 + letter.charCodeAt(0) - 64,
    0,
  );
  const columnName = (number: number): string => {
    if (number < 1 || number > 16384) throw invalidTemplate();
    let name = '';
    while (number > 0) {
      number--;
      name = String.fromCharCode(65 + (number % 26)) + name;
      number = Math.floor(number / 26);
    }
    return name;
  };
  const categoryColumn = columnName(columnNumber - 1);
  const resizeFormula = (formula: Element | undefined, column: string) => {
    if (!formula) throw invalidTemplate();
    const prefix = [sheetName, `'${sheetName.replaceAll("'", "''")}'`]
      .map((name) => `${name}!$${column}$${firstRow}:$${column}$`)
      .find((value) => formula.textContent?.startsWith(value));
    if (!prefix) throw invalidTemplate();
    const oldLastRow = Number(formula.textContent!.slice(prefix.length));
    if (!Number.isInteger(oldLastRow) || oldLastRow < firstRow)
      throw invalidTemplate();
    // Remove obsolete data only inside this chart's old range; leave other worksheet data alone.
    for (let row = lastRow + 1; row <= oldLastRow; row++) {
      const cell = Array.from(
        sheet.getElementsByTagNameNS(spreadsheet, 'c'),
      ).find((node) => node.getAttribute('r') === `${column}${row}`);
      if (cell) cell.parentNode!.removeChild(cell);
    }
    formula.textContent = `${prefix}${lastRow}`;
  };
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
    const categoryCache = category?.getElementsByTagNameNS(
      chartNs,
      'strCache',
    )[0];
    const categoryFormula = category?.getElementsByTagNameNS(chartNs, 'f')[0];
    if (!categoryCache) throw invalidTemplate();
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
