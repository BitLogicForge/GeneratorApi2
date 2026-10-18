import { invalidTemplate } from '@/pptx/jszip/package/invalid-template';

import { cmToEmu, readObjectBounds, writeObjectBounds } from './transform.ts';

import type { Element } from '@xmldom/xmldom';
import type { NamedObject } from '@/pptx/jszip/objects';
import type { MoveObjectOptions } from './types.ts';

/**
 * Moves a shape, table, or chart on its slide using absolute coordinates (`x`, `y`)
 * and/or relative offsets (`dx`, `dy`) in centimeters (cm).
 */
export function moveObject(
  target: NamedObject | Element,
  options: MoveObjectOptions,
): void {
  const { x, y, dx, dy } = options;
  if (
    x === undefined &&
    y === undefined &&
    dx === undefined &&
    dy === undefined
  ) {
    throw invalidTemplate(
      'Move options require at least one of x, y, dx, or dy',
    );
  }

  const bounds = readObjectBounds(target);
  const baseX = x !== undefined ? cmToEmu(x) : bounds.x;
  const baseY = y !== undefined ? cmToEmu(y) : bounds.y;
  const offsetX = dx !== undefined ? cmToEmu(dx) : 0;
  const offsetY = dy !== undefined ? cmToEmu(dy) : 0;

  writeObjectBounds(target, {
    ...bounds,
    x: baseX + offsetX,
    y: baseY + offsetY,
  });
}
