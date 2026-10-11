import JSZip from 'jszip';

import { invalidTemplate } from '@/pptx/jszip/package/invalid-template';
import { relationshipNs, spreadsheet } from '@/pptx/jszip/package/namespaces';
import { readXml } from '@/pptx/jszip/package/read-xml';
import { resolveRelationship } from '@/pptx/jszip/package/resolve-relationship';
import { writeXml } from '@/pptx/jszip/package/write-xml';

import type { Document } from '@xmldom/xmldom';

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
