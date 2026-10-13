import { drawing } from '@/pptx/jszip/package/namespaces';

import type { Element } from '@xmldom/xmldom';

/** Overrides text fill only, retaining run attributes and cell styling. */
export function setCellTextColor(cell: Element, color: string) {
  const document = cell.ownerDocument!;
  for (const run of Array.from(cell.getElementsByTagNameNS(drawing, 'r'))) {
    let properties = run.getElementsByTagNameNS(drawing, 'rPr')[0];
    if (!properties) {
      properties = document.createElementNS(drawing, 'a:rPr');
      run.insertBefore(properties, run.firstChild);
    }
    for (const child of Array.from(properties.childNodes)) {
      if (
        child.namespaceURI === drawing &&
        [
          'noFill',
          'solidFill',
          'gradFill',
          'blipFill',
          'pattFill',
          'grpFill',
        ].includes(child.localName ?? '')
      )
        properties.removeChild(child);
    }
    const fill = document.createElementNS(drawing, 'a:solidFill');
    const rgb = document.createElementNS(drawing, 'a:srgbClr');
    rgb.setAttribute('val', color.toUpperCase());
    fill.appendChild(rgb);
    const following = Array.from(properties.childNodes).find(
      (node) => node.nodeType === 1 && node.localName !== 'ln',
    );
    properties.insertBefore(fill, following ?? null);
  }
}
