import { invalidTemplate } from '@/pptx/jszip/package/invalid-template';
import { drawing } from '@/pptx/jszip/package/namespaces';

import { replaceRunRange } from './replace-run-range.ts';

import type { Element } from '@xmldom/xmldom';

/** Literal replacement within each paragraph, including text split across formatted runs. */
export function replaceParagraphText(
  element: Element,
  search: string,
  replacement: string,
): number {
  if (!search) throw invalidTemplate();
  const paragraphs =
    element.namespaceURI === drawing && element.localName === 'p'
      ? [element]
      : Array.from(element.getElementsByTagNameNS(drawing, 'p'));
  let count = 0;
  for (const paragraph of paragraphs) {
    const nodes = Array.from(paragraph.getElementsByTagNameNS(drawing, 't'));
    const original = nodes.map((node) => node.textContent ?? '');
    const text = original.join('');
    const positions: number[] = [];
    for (
      let start = text.indexOf(search);
      start !== -1;
      start = text.indexOf(search, start + search.length)
    )
      positions.push(start);
    for (const start of positions.reverse()) {
      replaceRunRange(
        nodes,
        original,
        start,
        start + search.length,
        replacement,
      );
      count++;
    }
  }
  return count;
}
