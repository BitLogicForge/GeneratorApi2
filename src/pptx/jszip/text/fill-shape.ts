import type { Element } from '@xmldom/xmldom';

import { invalidTemplate } from '@/pptx/jszip/package/invalid-template';

import { setText } from './set-text.ts';

export function fillTextShape(element: Element, text: string) {
  if (element.localName !== 'sp') throw invalidTemplate();
  setText(element, text);
}
