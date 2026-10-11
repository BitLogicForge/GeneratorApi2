import { invalidTemplate } from '@/pptx/jszip/package/invalid-template';

import { setText } from './set-text.ts';

import type { Element } from '@xmldom/xmldom';

export function fillTextShape(element: Element, text: string) {
  if (element.localName !== 'sp') throw invalidTemplate();
  setText(element, text);
}
