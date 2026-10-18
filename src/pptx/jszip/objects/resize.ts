import { invalidTemplate } from '@/pptx/jszip/package/invalid-template';
import { drawing } from '@/pptx/jszip/package/namespaces';

import {
  cmToEmu,
  getTargetElement,
  readObjectBounds,
  writeObjectBounds,
} from './transform.ts';

import type { Element } from '@xmldom/xmldom';
import type { NamedObject } from '@/pptx/jszip/objects';
import type { ResizeObjectOptions } from './types.ts';

function scaleElementsProportionally(
  elements: Element[],
  attribute: 'w' | 'h',
  targetTotal: number,
): void {
  if (elements.length === 0) return;
  if (targetTotal < elements.length) {
    throw invalidTemplate(
      'Table dimensions are too small for the number of rows or columns',
    );
  }

  const sizes = elements.map((el) =>
    Math.max(0, Number(el.getAttribute(attribute)) || 0),
  );
  const currentTotal = sizes.reduce((sum, size) => sum + size, 0);

  let cumulativeOld = 0;
  let prevScaled = 0;
  for (const [index, el] of elements.entries()) {
    cumulativeOld += sizes[index];
    const nextScaled =
      index === elements.length - 1
        ? targetTotal
        : currentTotal > 0
          ? Math.round((cumulativeOld / currentTotal) * targetTotal)
          : Math.round(((index + 1) / elements.length) * targetTotal);
    const scaledSize = Math.max(1, nextScaled - prevScaled);
    el.setAttribute(attribute, String(scaledSize));
    prevScaled += scaledSize;
  }
}

/**
 * Resizes a shape, table, or chart on its slide using absolute dimensions (`width`, `height`)
 * and/or relative deltas (`dWidth`, `dHeight`) in centimeters (cm).
 * When resizing a table, scales `<a:gridCol w>` and `<a:tr h>` proportionally.
 */
export function resizeObject(
  target: NamedObject | Element,
  options: ResizeObjectOptions,
): void {
  const { width, height, dWidth, dHeight } = options;
  const widthChanged = width !== undefined || dWidth !== undefined;
  const heightChanged = height !== undefined || dHeight !== undefined;
  if (!widthChanged && !heightChanged) {
    throw invalidTemplate(
      'Resize options require at least one of width, height, dWidth, or dHeight',
    );
  }

  const element = getTargetElement(target);
  const bounds = readObjectBounds(target);
  const baseCx = width !== undefined ? cmToEmu(width) : bounds.cx;
  const baseCy = height !== undefined ? cmToEmu(height) : bounds.cy;
  const deltaCx = dWidth !== undefined ? cmToEmu(dWidth) : 0;
  const deltaCy = dHeight !== undefined ? cmToEmu(dHeight) : 0;

  const nextCx = baseCx + deltaCx;
  const nextCy = baseCy + deltaCy;
  if (nextCx <= 0 || nextCy <= 0) {
    throw invalidTemplate('Object width and height must be positive');
  }

  const table = element.getElementsByTagNameNS(drawing, 'tbl')[0];
  if (table) {
    if (widthChanged) {
      const grid = table.getElementsByTagNameNS(drawing, 'tblGrid')[0];
      const columns = grid
        ? Array.from(grid.getElementsByTagNameNS(drawing, 'gridCol'))
        : [];
      scaleElementsProportionally(columns, 'w', nextCx);
    }
    if (heightChanged) {
      const rows = Array.from(table.getElementsByTagNameNS(drawing, 'tr'));
      scaleElementsProportionally(rows, 'h', nextCy);
    }
  }

  writeObjectBounds(target, {
    ...bounds,
    cx: nextCx,
    cy: nextCy,
  });
}
