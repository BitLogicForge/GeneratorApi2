import { invalidTemplate } from '@/pptx/jszip/package/invalid-template';
import { spreadsheet } from '@/pptx/jszip/package/namespaces';

import type { Element } from '@xmldom/xmldom';

export function renameTableColumns(table: Element, seriesNames: string[]) {
  const columns = Array.from(table.getElementsByTagNameNS(spreadsheet, 'tableColumn'));
  if (
    columns.length !== seriesNames.length + 1 ||
    new Set([columns[0].getAttribute('name'), ...seriesNames]).size !== columns.length ||
    seriesNames.some((name) => !name)
  )
    throw invalidTemplate();
  for (const [index, name] of seriesNames.entries()) columns[index + 1].setAttribute('name', name);
}
