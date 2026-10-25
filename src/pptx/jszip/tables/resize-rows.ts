import { TABLE_MERGE_ATTRIBUTES } from '@/pptx/jszip/package/constants';
import { invalidTemplate } from '@/pptx/jszip/package/invalid-template';
import { drawing, presentationNs } from '@/pptx/jszip/package/namespaces';

import { createTableIdentifierRefresher } from './refresh-identifiers.ts';

import type { Element } from '@xmldom/xmldom';

export function resizeTableRows(
  element: Element,
  table: Element,
  rows: Element[],
  startRow: number,
  rowCount: number,
) {
  if (!Number.isInteger(startRow) || startRow < 0 || startRow >= rows.length)
    throw invalidTemplate(
      `Table startRow ${startRow} is outside the template's ${rows.length} rows`,
    );
  if (!rowCount) throw invalidTemplate('Table data must contain at least one row to resize rows');
  for (const cell of Array.from(table.getElementsByTagNameNS(drawing, 'tc'))) {
    if (TABLE_MERGE_ATTRIBUTES.some((attribute) => cell.hasAttribute(attribute)))
      throw invalidTemplate('Tables with merged cells cannot be resized (resizeRows)');
  }
  const oldHeight = rows.reduce((sum, row) => sum + Number(row.getAttribute('h')), 0);
  const targetCount = startRow + rowCount;
  const refreshIdentifiers = createTableIdentifierRefresher(table);
  while (rows.length < targetCount) {
    const clone = rows.at(-1)!.cloneNode(true) as Element;
    refreshIdentifiers(clone);
    table.appendChild(clone);
    rows.push(clone);
  }
  while (rows.length > targetCount) table.removeChild(rows.pop()!);
  const extent = element
    .getElementsByTagNameNS(presentationNs, 'xfrm')[0]
    ?.getElementsByTagNameNS(drawing, 'ext')[0];
  if (extent)
    extent.setAttribute(
      'cy',
      String(
        Number(extent.getAttribute('cy')) +
          rows.reduce((sum, row) => sum + Number(row.getAttribute('h')), 0) -
          oldHeight,
      ),
    );
}
