import { randomInt } from 'node:crypto';

import type { Element } from '@xmldom/xmldom';

const namespace = 'http://schemas.microsoft.com/office/drawing/2014/main';

/** Gives cloned Office table row/column identifiers new collision-free values. */
export function createTableIdentifierRefresher(table: Element) {
  const used = new Set(
    ['rowId', 'colId'].flatMap((name) =>
      Array.from(table.getElementsByTagNameNS(namespace, name)).map((node) =>
        node.getAttribute('val'),
      ),
    ),
  );
  return (clone: Element) => {
    for (const name of ['rowId', 'colId']) {
      for (const node of Array.from(
        clone.getElementsByTagNameNS(namespace, name),
      )) {
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
