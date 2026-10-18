import { TABLE_MERGE_ATTRIBUTES } from '@/pptx/jszip/package/constants';
import { invalidTemplate } from '@/pptx/jszip/package/invalid-template';
import { drawing, presentationNs } from '@/pptx/jszip/package/namespaces';

import { createTableIdentifierRefresher } from './refresh-identifiers.ts';

import type { Element } from '@xmldom/xmldom';

export function resizeTableColumns(
  element: Element,
  table: Element,
  rows: Element[],
  startColumn: number,
  columnCount: number,
) {
  const grid = table.getElementsByTagNameNS(drawing, 'tblGrid')[0];
  if (!grid) throw invalidTemplate();
  const columns = Array.from(grid.getElementsByTagNameNS(drawing, 'gridCol'));
  const cellsByRow = rows.map((row) =>
    Array.from(row.getElementsByTagNameNS(drawing, 'tc')),
  );
  if (
    startColumn >= columns.length ||
    cellsByRow.some((cells) => cells.length !== columns.length) ||
    cellsByRow
      .flat()
      .some((cell) =>
        TABLE_MERGE_ATTRIBUTES.some((attribute) =>
          cell.hasAttribute(attribute),
        ),
      )
  )
    throw invalidTemplate();
  const oldWidth = columns.reduce(
    (sum, column) => sum + Number(column.getAttribute('w')),
    0,
  );
  const targetCount = startColumn + columnCount;
  const refreshIdentifiers = createTableIdentifierRefresher(table);
  while (columns.length < targetCount) {
    const clone = columns.at(-1)!.cloneNode(true) as Element;
    refreshIdentifiers(clone);
    grid.appendChild(clone);
    columns.push(clone);
  }
  while (columns.length > targetCount) grid.removeChild(columns.pop()!);
  for (const [index, cells] of cellsByRow.entries()) {
    while (cells.length < targetCount) {
      const clone = cells.at(-1)!.cloneNode(true) as Element;
      const extension = Array.from(rows[index].childNodes).find(
        (node) => node.namespaceURI === drawing && node.localName === 'extLst',
      );
      rows[index].insertBefore(clone, extension ?? null);
      cells.push(clone);
    }
    while (cells.length > targetCount) rows[index].removeChild(cells.pop()!);
  }
  const extent = element
    .getElementsByTagNameNS(presentationNs, 'xfrm')[0]
    ?.getElementsByTagNameNS(drawing, 'ext')[0];
  if (extent)
    extent.setAttribute(
      'cx',
      String(
        Number(extent.getAttribute('cx')) +
          columns.reduce(
            (sum, column) => sum + Number(column.getAttribute('w')),
            0,
          ) -
          oldWidth,
      ),
    );
}
