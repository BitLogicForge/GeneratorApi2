import JSZip from 'jszip';
import type { Document } from '@xmldom/xmldom';
import {
  chartNs,
  spreadsheet,
  relationshipNs,
  readXml,
  writeXml,
  resolveRelationship,
  invalidTemplate,
} from '@/pptx/jszip/package';

export async function loadChartWorkbook(
  zip: JSZip,
  chart: Document,
  chartPath: string,
  sheetName: string,
) {
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
  return { workbook, workbookPath, sheet, sheetPath };
}

export async function resizeWorkbookTables(
  workbook: JSZip,
  sheet: Document,
  sheetPath: string,
  categoryColumn: string,
  firstRow: number,
  lastRow: number,
  seriesNames?: string[],
) {
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
    if (seriesNames) {
      const columns = Array.from(
        root.getElementsByTagNameNS(spreadsheet, 'tableColumn'),
      );
      if (
        columns.length !== seriesNames.length + 1 ||
        new Set([columns[0].getAttribute('name'), ...seriesNames]).size !==
          columns.length ||
        seriesNames.some((name) => !name)
      )
        throw invalidTemplate();
      for (const [index, name] of seriesNames.entries())
        columns[index + 1].setAttribute('name', name);
    }
    for (const filter of Array.from(
      root.getElementsByTagNameNS(spreadsheet, 'autoFilter'),
    ))
      filter.setAttribute('ref', resized);
    writeXml(workbook, tablePath, table);
  }
}
