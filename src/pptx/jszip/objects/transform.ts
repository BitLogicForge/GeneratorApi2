import { EMU_PER_CM } from '@/pptx/jszip/package/constants';
import { invalidTemplate } from '@/pptx/jszip/package/invalid-template';
import { drawing, presentationNs } from '@/pptx/jszip/package/namespaces';

import type { Element } from '@xmldom/xmldom';
import type { NamedObject } from '@/pptx/jszip/objects';
import type { ObjectBoundsEmu } from './types.ts';

export function isNamedObject(target: NamedObject | Element): target is NamedObject {
  return 'element' in target && 'path' in target;
}

export function getTargetElement(target: NamedObject | Element): Element {
  const element = isNamedObject(target) ? target.element : target;
  if (!element.parentNode) {
    throw invalidTemplate('Cannot manipulate a deleted object');
  }
  return element;
}

export function cmToEmu(centimeters: number): number {
  if (!Number.isFinite(centimeters)) {
    throw invalidTemplate(`Invalid centimeter measurement: ${centimeters}`);
  }
  return Math.round(centimeters * EMU_PER_CM);
}

function findDirectChild(
  parent: Element,
  namespace: string,
  localName: string,
): Element | undefined {
  return Array.from(parent.childNodes).find(
    (node): node is Element =>
      node.nodeType === 1 && node.namespaceURI === namespace && node.localName === localName,
  );
}

export function findDirectTransformElement(element: Element): Element | undefined {
  if (element.localName === 'graphicFrame') {
    return findDirectChild(element, presentationNs, 'xfrm');
  }
  if (element.localName === 'sp' || element.localName === 'pic') {
    const spPr = findDirectChild(element, presentationNs, 'spPr');
    return spPr ? findDirectChild(spPr, drawing, 'xfrm') : undefined;
  }
  return undefined;
}

export function parseTransformElementBounds(xfrm: Element): ObjectBoundsEmu | undefined {
  const off = findDirectChild(xfrm, drawing, 'off');
  const ext = findDirectChild(xfrm, drawing, 'ext');
  if (!off || !ext) return undefined;
  const x = Number(off.getAttribute('x'));
  const y = Number(off.getAttribute('y'));
  const cx = Number(ext.getAttribute('cx'));
  const cy = Number(ext.getAttribute('cy'));
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(cx) || !Number.isFinite(cy)) {
    return undefined;
  }
  return { x, y, cx, cy };
}

export function readObjectBounds(target: NamedObject | Element): ObjectBoundsEmu {
  const element = getTargetElement(target);
  const xfrm = findDirectTransformElement(element);
  if (xfrm) {
    const bounds = parseTransformElementBounds(xfrm);
    if (!bounds) {
      throw invalidTemplate('Object <xfrm> is missing valid <a:off> or <a:ext>');
    }
    return bounds;
  }
  if (isNamedObject(target) && target.placeholderBounds) {
    return { ...target.placeholderBounds };
  }
  throw invalidTemplate('Object is missing a 2D transform (<xfrm>)');
}

function ensureTransformElement(element: Element): Element {
  const existing = findDirectTransformElement(element);
  if (existing) return existing;

  const doc = element.ownerDocument;
  if (!doc) throw invalidTemplate('Object element has no owner document');

  if (element.localName === 'sp' || element.localName === 'pic') {
    const spPr = findDirectChild(element, presentationNs, 'spPr');
    if (!spPr) throw invalidTemplate('Shape is missing <p:spPr>');
    const xfrm = doc.createElementNS(drawing, 'a:xfrm');
    // In CT_ShapeProperties, <a:xfrm> must be the first child of <p:spPr>.
    spPr.insertBefore(xfrm, spPr.firstChild);
    return xfrm;
  }

  throw invalidTemplate('Graphic frame is missing <p:xfrm>');
}

export function writeObjectBounds(target: NamedObject | Element, bounds: ObjectBoundsEmu): void {
  const element = getTargetElement(target);
  const xfrm = ensureTransformElement(element);
  const doc = element.ownerDocument!;

  let off = findDirectChild(xfrm, drawing, 'off');
  if (!off) {
    off = doc.createElementNS(drawing, 'a:off');
    xfrm.insertBefore(off, xfrm.firstChild);
  }
  let ext = findDirectChild(xfrm, drawing, 'ext');
  if (!ext) {
    ext = doc.createElementNS(drawing, 'a:ext');
    xfrm.insertBefore(ext, off.nextSibling);
  }

  off.setAttribute('x', String(bounds.x));
  off.setAttribute('y', String(bounds.y));
  ext.setAttribute('cx', String(bounds.cx));
  ext.setAttribute('cy', String(bounds.cy));
}
