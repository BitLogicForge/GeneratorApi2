import type { Element } from '@xmldom/xmldom';
import { drawing } from './package.js';

export function setText(element: Element, value: string) {
  const document = element.ownerDocument!;
  let texts = Array.from(element.getElementsByTagNameNS(drawing, 't'));
  if (!texts.length) {
    const paragraph = element.getElementsByTagNameNS(drawing, 'p')[0];
    const run = document.createElementNS(drawing, 'a:r');
    const endProperties = paragraph.getElementsByTagNameNS(
      drawing,
      'endParaRPr',
    )[0];
    if (endProperties) {
      const properties = document.createElementNS(drawing, 'a:rPr');
      for (const attribute of Array.from(endProperties.attributes))
        properties.setAttributeNS(
          attribute.namespaceURI,
          attribute.name,
          attribute.value,
        );
      run.appendChild(properties);
    }
    const node = document.createElementNS(drawing, 'a:t');
    run.appendChild(node);
    paragraph.insertBefore(run, endProperties ?? null);
    texts = [node];
  }
  texts[0].textContent = value;
  for (const node of texts.slice(1)) node.textContent = '';
}

export interface FillTableOptions {
  startRow?: number;
}

export function fillTable(
  element: Element,
  data: (string | number)[][],
  { startRow = 0 }: FillTableOptions = {},
) {
  const table = element.getElementsByTagNameNS(drawing, 'tbl')[0];
  const rows = Array.from(table.getElementsByTagNameNS(drawing, 'tr'));
  for (const [rowIndex, row] of rows.slice(startRow).entries()) {
    const cells = Array.from(row.getElementsByTagNameNS(drawing, 'tc'));
    for (const [columnIndex, cell] of cells.entries()) {
      setText(cell, String(data[rowIndex][columnIndex]));
    }
  }
}

export function fillTextShape(element: Element, text: string) {
  setText(element, text);
}
