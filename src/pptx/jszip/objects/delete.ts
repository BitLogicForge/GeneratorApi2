import { getTargetElement } from './transform.ts';

import type { Element } from '@xmldom/xmldom';
import type { NamedObject } from '@/pptx/jszip/objects';

/** Removes a shape, table, or chart element from its slide. */
export function deleteObject(target: NamedObject | Element): void {
  const element = getTargetElement(target);
  element.parentNode!.removeChild(element);
}
