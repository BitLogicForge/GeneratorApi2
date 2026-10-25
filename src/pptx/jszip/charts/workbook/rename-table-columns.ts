import { invalidTemplate } from '@/pptx/jszip/package/invalid-template';
import { spreadsheet } from '@/pptx/jszip/package/namespaces';

import type { Element } from '@xmldom/xmldom';

export function renameTableColumns(table: Element, seriesNames: string[]) {
  const columns = Array.from(table.getElementsByTagNameNS(spreadsheet, 'tableColumn'));
  const names = columns.map((column) => column.getAttribute('name'));
  if (columns.length !== seriesNames.length + 1)
    throw invalidTemplate(
      `Chart workbook table has ${columns.length} columns; seriesNames needs ${seriesNames.length + 1} (category + series)`,
      { tableColumns: names, seriesNames },
    );
  if (
    new Set([names[0], ...seriesNames]).size !== columns.length ||
    seriesNames.some((name) => !name)
  )
    throw invalidTemplate(
      'Chart seriesNames must be non-empty, unique, and differ from the category column',
      {
        tableColumns: names,
        seriesNames,
      },
    );
  for (const [index, name] of seriesNames.entries()) columns[index + 1].setAttribute('name', name);
}
