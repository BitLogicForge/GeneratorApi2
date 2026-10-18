import { drawing, presentationNs } from '@/pptx/jszip/package/namespaces';

import type { Element } from '@xmldom/xmldom';
import type { ObjectBoundsEmu } from './types.ts';

function findDirectChild(
  parent: Element,
  namespace: string,
  localName: string,
): Element | undefined {
  return Array.from(parent.childNodes).find(
    (node): node is Element =>
      node.nodeType === 1 &&
      node.namespaceURI === namespace &&
      node.localName === localName,
  );
}

export function findDirectTransformElement(
  element: Element,
): Element | undefined {
  if (element.localName === 'graphicFrame') {
    return findDirectChild(element, presentationNs, 'xfrm');
  }
  if (element.localName === 'sp' || element.localName === 'pic') {
    const spPr = findDirectChild(element, presentationNs, 'spPr');
    return spPr ? findDirectChild(spPr, drawing, 'xfrm') : undefined;
  }
  return undefined;
}

export function parseTransformElementBounds(
  xfrm: Element,
): ObjectBoundsEmu | undefined {
  const off = findDirectChild(xfrm, drawing, 'off');
  const ext = findDirectChild(xfrm, drawing, 'ext');
  if (!off || !ext) return undefined;
  const x = Number(off.getAttribute('x'));
  const y = Number(off.getAttribute('y'));
  const cx = Number(ext.getAttribute('cx'));
  const cy = Number(ext.getAttribute('cy'));
  if (
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    !Number.isFinite(cx) ||
    !Number.isFinite(cy)
  ) {
    return undefined;
  }
  return { x, y, cx, cy };
}
