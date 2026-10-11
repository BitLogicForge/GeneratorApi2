import { spreadsheet } from '@/pptx/jszip/package/namespaces';

import { renameTableColumns } from './rename-table-columns.ts';

import type { Document } from '@xmldom/xmldom';
import type { TableResizeOptions } from './types.ts';

export function resizeWorkbookTable(
  table: Document,
  { categoryColumn, firstRow, lastRow, seriesNames }: TableResizeOptions,
): boolean {
  const root = table.documentElement!;
  const range = root.getAttribute('ref');
  if (!range?.startsWith(`${categoryColumn}${firstRow - 1}:`)) return false;
  const resized = range.replace(/\d+$/, String(lastRow));
  root.setAttribute('ref', resized);
  if (seriesNames) renameTableColumns(root, seriesNames);
  for (const filter of Array.from(
    root.getElementsByTagNameNS(spreadsheet, 'autoFilter'),
  ))
    filter.setAttribute('ref', resized);
  return true;
}
