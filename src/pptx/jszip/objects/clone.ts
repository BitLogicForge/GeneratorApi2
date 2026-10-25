import { randomInt, randomUUID } from 'node:crypto';

import { invalidTemplate } from '@/pptx/jszip/package/invalid-template';
import { officeDrawingNs, presentationNs } from '@/pptx/jszip/package/namespaces';
import { createTableIdentifierRefresher } from '@/pptx/jszip/tables/refresh-identifiers';

import { getTargetElement, isNamedObject, writeObjectBounds } from './transform.ts';

import type { Element } from '@xmldom/xmldom';
import type { NamedObject } from '@/pptx/jszip/objects';

/**
 * Clones a shape, image, table, or chart element within its slide,
 * allocating collision-free identifiers and refreshing Office drawing GUIDs.
 */
export function cloneObject(target: NamedObject | Element, name?: string): NamedObject {
  const element = getTargetElement(target);
  const parent = element.parentNode;
  if (!parent) {
    throw invalidTemplate('Cannot clone a deleted object');
  }

  const doc = element.ownerDocument;
  if (!doc) {
    throw invalidTemplate('Object element has no owner document');
  }

  const existingIds = Array.from(doc.getElementsByTagNameNS(presentationNs, 'cNvPr')).map(
    (node) => Number(node.getAttribute('id')) || 0,
  );
  const nextId = Math.max(0, ...existingIds) + 1;

  const cloneElement = element.cloneNode(true) as Element;
  const cNvPr = cloneElement.getElementsByTagNameNS(presentationNs, 'cNvPr')[0];
  if (!cNvPr) {
    throw invalidTemplate('Cloned object is missing <p:cNvPr>');
  }

  const originalName = cNvPr.getAttribute('name') ?? 'Object';
  cNvPr.setAttribute('id', String(nextId));
  cNvPr.setAttribute('name', name ?? `${originalName} (Copy ${nextId})`);

  for (const node of Array.from(
    cloneElement.getElementsByTagNameNS(officeDrawingNs, 'creationId'),
  )) {
    node.setAttribute('id', `{${randomUUID().toUpperCase()}}`);
  }

  for (const node of Array.from(cloneElement.getElementsByTagName('*'))) {
    if (node.localName === 'modId') {
      node.setAttribute('val', String(randomInt(1, 0x100000000)));
    }
  }

  if (cloneElement.getElementsByTagNameNS('*', 'tbl')[0]) {
    createTableIdentifierRefresher(doc.documentElement ?? cloneElement)(cloneElement);
  }

  parent.insertBefore(cloneElement, element.nextSibling);

  const isNamed = isNamedObject(target);
  const placeholderBounds = isNamed ? target.placeholderBounds : undefined;
  if (placeholderBounds) {
    writeObjectBounds(cloneElement, placeholderBounds);
  }

  return {
    path: isNamed ? target.path : '',
    element: cloneElement,
    ...(placeholderBounds ? { placeholderBounds: { ...placeholderBounds } } : {}),
  };
}
