import { RelationshipType } from '@/pptx/jszip/package/constants';
import { relationshipNs, spreadsheet } from '@/pptx/jszip/package/namespaces';
import { readXml } from '@/pptx/jszip/package/read-xml';
import { resolveRelationship } from '@/pptx/jszip/package/resolve-relationship';
import { writeXml } from '@/pptx/jszip/package/write-xml';

import { readWorksheetBounds } from './workbook/bounds.ts';
import { updateWorksheetDimension } from './workbook/dimension.ts';
import { resizeWorkbookTable } from './workbook/resize-table.ts';

import type { Document } from '@xmldom/xmldom';
import type JSZip from 'jszip';

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
    updateWorksheetDimension(dimension, readWorksheetBounds(sheet));
  const options = { categoryColumn, firstRow, lastRow, seriesNames };
  for (const tablePart of Array.from(
    sheet.getElementsByTagNameNS(spreadsheet, 'tablePart'),
  )) {
    const tablePath = await resolveRelationship(
      workbook,
      sheetPath,
      tablePart.getAttributeNS(relationshipNs, 'id'),
      RelationshipType.Table,
    );
    const table = await readXml(workbook, tablePath);
    if (resizeWorkbookTable(table, options))
      writeXml(workbook, tablePath, table);
  }
}
