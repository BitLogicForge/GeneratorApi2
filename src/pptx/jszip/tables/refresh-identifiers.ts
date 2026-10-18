import { randomInt } from 'node:crypto';

import { officeDrawingNs } from '@/pptx/jszip/package/namespaces';

import type { Element } from '@xmldom/xmldom';

/** Gives cloned Office table row/column identifiers new collision-free values. */
export function createTableIdentifierRefresher(table: Element) {
  const used = new Set(
    ['rowId', 'colId'].flatMap((name) =>
      Array.from(table.getElementsByTagNameNS(officeDrawingNs, name)).map((node) =>
        node.getAttribute('val'),
      ),
    ),
  );
  return (clone: Element) => {
    for (const name of ['rowId', 'colId']) {
      for (const node of Array.from(clone.getElementsByTagNameNS(officeDrawingNs, name))) {
        let value: string;
        do {
          value = String(randomInt(0x100000000));
        } while (used.has(value));
        used.add(value);
        node.setAttribute('val', value);
      }
    }
  };
}
