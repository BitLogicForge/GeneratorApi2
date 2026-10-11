import { invalidTemplate } from '@/pptx/jszip/package/invalid-template';

import type { Element } from '@xmldom/xmldom';

export function readCellAddress(
  cell: Element,
  previousColumn: number,
  rowNumber: number,
) {
  const reference = cell.getAttribute('r');
  const address = reference ? /^([A-Z]+)([1-9]\d*)$/.exec(reference) : null;
  if (reference && !address) throw invalidTemplate();
  const column = address
    ? Array.from(address[1]).reduce(
        (number, letter) => number * 26 + letter.charCodeAt(0) - 64,
        0,
      )
    : previousColumn + 1;
  const row = address ? Number(address[2]) : rowNumber;
  if (column > 16384 || row > 1048576) throw invalidTemplate();
  return { column, row };
}
