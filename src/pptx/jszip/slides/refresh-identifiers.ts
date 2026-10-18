import { randomInt, randomUUID } from 'node:crypto';

import {
  officeChartNs,
  officeDrawingNs,
  officePowerPointNs,
} from '@/pptx/jszip/package/namespaces';
import { createTableIdentifierRefresher } from '@/pptx/jszip/tables/refresh-identifiers';

import type { Document } from '@xmldom/xmldom';

/** Refreshes slide-level and drawing-level unique identifiers in a copied slide document. */
export function refreshSlideIdentifiers(doc: Document): void {
  // 1. Slide-level creationId (p14:creationId val="...")
  for (const node of Array.from(
    doc.getElementsByTagNameNS(officePowerPointNs, 'creationId'),
  )) {
    if (node.hasAttribute('val')) {
      node.setAttribute('val', String(randomInt(1, 0x7fffffff)));
    }
  }

  // 2. Shape-level creationId (a16:creationId id="{...}")
  for (const node of Array.from(
    doc.getElementsByTagNameNS(officeDrawingNs, 'creationId'),
  )) {
    if (node.hasAttribute('id')) {
      node.setAttribute('id', `{${randomUUID().toUpperCase()}}`);
    }
  }

  // 3. Shape modification IDs (modId)
  for (const node of Array.from(doc.getElementsByTagName('*'))) {
    if (node.localName === 'modId' && node.hasAttribute('val')) {
      node.setAttribute('val', String(randomInt(1, 0x100000000)));
    }
  }

  // 4. Table column and row IDs
  if (doc.documentElement) {
    createTableIdentifierRefresher(doc.documentElement)(doc.documentElement);
  }
}

/** Refreshes unique IDs in a copied chart document. */
export function refreshChartIdentifiers(doc: Document): void {
  for (const node of Array.from(
    doc.getElementsByTagNameNS(officeChartNs, 'uniqueId'),
  )) {
    if (node.hasAttribute('val')) {
      node.setAttribute('val', `{${randomUUID().toUpperCase()}}`);
    }
  }
}
