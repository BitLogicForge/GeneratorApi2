import { invalidTemplate } from '@/pptx/jszip/package/invalid-template';
import { drawing } from '@/pptx/jszip/package/namespaces';

import type { Element } from '@xmldom/xmldom';

export function resizeTableRows(
  element: Element,
  table: Element,
  rows: Element[],
  startRow: number,
  rowCount: number,
) {
  if (
    !Number.isInteger(startRow) ||
    startRow < 0 ||
    startRow >= rows.length ||
    !rowCount
  )
    throw invalidTemplate();
  for (const cell of Array.from(table.getElementsByTagNameNS(drawing, 'tc'))) {
    if (
      ['rowSpan', 'gridSpan', 'hMerge', 'vMerge'].some((attribute) =>
        cell.hasAttribute(attribute),
      )
    )
      throw invalidTemplate();
  }
  const oldHeight = rows.reduce(
    (sum, row) => sum + Number(row.getAttribute('h')),
    0,
  );
  while (rows.length < startRow + rowCount) {
    const clone = rows.at(-1)!.cloneNode(true) as Element;
    table.appendChild(clone);
    rows.push(clone);
  }
  while (rows.length > startRow + rowCount) table.removeChild(rows.pop()!);
  const extent = element
    .getElementsByTagNameNS(
      'http://schemas.openxmlformats.org/presentationml/2006/main',
      'xfrm',
    )[0]
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
