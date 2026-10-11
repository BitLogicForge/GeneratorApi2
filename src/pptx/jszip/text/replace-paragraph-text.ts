import type { Element } from '@xmldom/xmldom';
import { drawing } from '@/pptx/jszip/package/namespaces';
import { invalidTemplate } from '@/pptx/jszip/package/invalid-template';

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
      const end = start + search.length;
      let offset = 0;
      for (const [index, node] of nodes.entries()) {
        const nodeStart = offset;
        offset += original[index].length;
        if (offset <= start || nodeStart >= end) continue;
        const current = node.textContent ?? '';
        node.textContent =
          current.slice(0, Math.max(0, start - nodeStart)) +
          (start >= nodeStart ? replacement : '') +
          current.slice(Math.min(original[index].length, end - nodeStart));
      }
      count++;
    }
  }
  return count;
}
