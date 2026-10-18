import { randomInt, randomUUID } from 'node:crypto';

import { invalidTemplate } from '@/pptx/jszip/package/invalid-template';
import {
  drawing,
  officeDrawingNs,
  presentationNs,
} from '@/pptx/jszip/package/namespaces';
import { createTableIdentifierRefresher } from '@/pptx/jszip/tables/refresh-identifiers';

import {
  findDirectChild,
  getTargetElement,
  isNamedObject,
  writeObjectBounds,
} from './transform.ts';

import type { Element } from '@xmldom/xmldom';
import type { NamedObject } from '@/pptx/jszip/objects';

/** Ensures a shape element has preset geometry in compliant DrawingML sequence. */
function ensureShapeGeometry(element: Element): void {
  const spPr = findDirectChild(element, presentationNs, 'spPr');
  if (!spPr) return;
  const doc = element.ownerDocument;
  if (!doc) return;

  const existingGeom =
    findDirectChild(spPr, drawing, 'prstGeom') ??
    findDirectChild(spPr, drawing, 'custGeom');
  if (existingGeom) return;

  const prstGeom = doc.createElementNS(drawing, 'a:prstGeom');
  prstGeom.setAttribute('prst', 'rect');
  prstGeom.appendChild(doc.createElementNS(drawing, 'a:avLst'));

  // In CT_ShapeProperties schema, EG_Geometry comes immediately after xfrm.
  const xfrm = findDirectChild(spPr, drawing, 'xfrm');
  if (xfrm && xfrm.nextSibling) {
    spPr.insertBefore(prstGeom, xfrm.nextSibling);
  } else if (xfrm) {
    spPr.appendChild(prstGeom);
  } else {
    spPr.insertBefore(prstGeom, spPr.firstChild);
  }
}

/**
 * Clones a shape, image, table, or chart element within its slide,
 * allocating collision-free identifiers and refreshing Office drawing GUIDs.
 */
export function cloneObject(
  target: NamedObject | Element,
  name?: string,
): NamedObject {
  const element = getTargetElement(target);
  const parent = element.parentNode;
  if (!parent) {
    throw invalidTemplate('Cannot clone a deleted object');
  }

  const doc = element.ownerDocument;
  if (!doc) {
    throw invalidTemplate('Object element has no owner document');
  }

  const existingIds = Array.from(
    doc.getElementsByTagNameNS(presentationNs, 'cNvPr'),
  ).map((node) => Number(node.getAttribute('id')) || 0);
  const nextId = Math.max(0, ...existingIds) + 1;

  const cloneElement = element.cloneNode(true) as Element;
  const cNvPr = cloneElement.getElementsByTagNameNS(presentationNs, 'cNvPr')[0];
  if (!cNvPr) {
    throw invalidTemplate('Cloned object is missing <p:cNvPr>');
  }

  const originalName = cNvPr.getAttribute('name') ?? 'Object';
  cNvPr.setAttribute('id', String(nextId));
  cNvPr.setAttribute('name', name ?? `${originalName} (Copy ${nextId})`);

  // Strip placeholder identity so cloned shape doesn't conflict with layout placeholders.
  for (const ph of Array.from(
    cloneElement.getElementsByTagNameNS(presentationNs, 'ph'),
  )) {
    ph.parentNode?.removeChild(ph);
  }

  // Remove grouping locks inherited from placeholder definitions.
  for (const locks of Array.from(
    cloneElement.getElementsByTagNameNS(drawing, 'spLocks'),
  )) {
    locks.removeAttribute('noGrp');
  }

  for (const node of Array.from(
    cloneElement.getElementsByTagNameNS(officeDrawingNs, 'creationId'),
  )) {
    node.setAttribute('id', `{${randomUUID().toUpperCase()}}`);
  }

  for (const node of Array.from(cloneElement.getElementsByTagName('*'))) {
    if (node.localName === 'modId' && node.hasAttribute('val')) {
      node.setAttribute('val', String(randomInt(1, 0x100000000)));
    }
    if (node.localName === 'uniqueId' && node.hasAttribute('val')) {
      node.setAttribute('val', `{${randomUUID().toUpperCase()}}`);
    }
  }

  if (cloneElement.getElementsByTagNameNS('*', 'tbl')[0]) {
    createTableIdentifierRefresher(doc.documentElement ?? cloneElement)(
      cloneElement,
    );
  }

  parent.insertBefore(cloneElement, element.nextSibling);

  const isNamed = isNamedObject(target);
  const placeholderBounds = isNamed ? target.placeholderBounds : undefined;
  if (placeholderBounds) {
    writeObjectBounds(cloneElement, placeholderBounds);
  }

  if (cloneElement.localName === 'sp') {
    ensureShapeGeometry(cloneElement);
  }

  return {
    path: isNamed ? target.path : '',
    element: cloneElement,
    ...(placeholderBounds
      ? { placeholderBounds: { ...placeholderBounds } }
      : {}),
  };
}
