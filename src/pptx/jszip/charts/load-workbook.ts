import JSZip from 'jszip';
import type { Document } from '@xmldom/xmldom';
import {
  chartNs,
  spreadsheet,
  relationshipNs,
} from '@/pptx/jszip/package/namespaces';
import { readXml } from '@/pptx/jszip/package/read-xml';

import { resolveRelationship } from '@/pptx/jszip/package/resolve-relationship';
import { invalidTemplate } from '@/pptx/jszip/package/invalid-template';

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
