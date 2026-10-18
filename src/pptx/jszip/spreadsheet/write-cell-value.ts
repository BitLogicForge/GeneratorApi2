import { spreadsheet } from '@/pptx/jszip/package/namespaces';

import type { Document, Element } from '@xmldom/xmldom';

const NEEDS_SPACE_PRESERVE = /^\s|\s$|\s{2,}/;
const XML_NAMESPACE = 'http://www.w3.org/XML/1998/namespace';

/** Replaces `<c>` cell contents with a numeric `<v>` or inline string `<is><t>`. */
export function writeCellValue(
  sheet: Document,
  cell: Element,
  value: string | number,
): void {
  while (cell.firstChild) {
    cell.removeChild(cell.firstChild);
  }
  if (typeof value === 'number') {
    cell.removeAttribute('t');
    const vNode = sheet.createElementNS(spreadsheet, 'v');
    vNode.textContent = String(value);
    cell.appendChild(vNode);
    return;
  }
  cell.setAttribute('t', 'inlineStr');
  const isNode = sheet.createElementNS(spreadsheet, 'is');
  const tNode = sheet.createElementNS(spreadsheet, 't');
  if (NEEDS_SPACE_PRESERVE.test(value)) {
    tNode.setAttributeNS(XML_NAMESPACE, 'xml:space', 'preserve');
  }
  tNode.textContent = value;
  isNode.appendChild(tNode);
  cell.appendChild(isNode);
}
