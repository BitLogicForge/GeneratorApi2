import type { Element } from '@xmldom/xmldom';
import { drawing, invalidTemplate } from './package.ts';

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

/** Replaces body paragraphs, cloning the last paragraph's bullets and run style when growing. */
export function fillParagraphs(element: Element, values: string[]): void {
  const body = element.getElementsByTagNameNS(
    'http://schemas.openxmlformats.org/presentationml/2006/main',
    'txBody',
  )[0];
  if (!body || !values.length) throw invalidTemplate();
  const paragraphs = Array.from(body.getElementsByTagNameNS(drawing, 'p'));
  if (!paragraphs.length) throw invalidTemplate();
  for (let index = paragraphs.length; index < values.length; index++) {
    const clone = paragraphs.at(-1)!.cloneNode(true) as Element;
    body.appendChild(clone);
    paragraphs.push(clone);
  }
  for (const [index, paragraph] of paragraphs.entries()) {
    if (index >= values.length) {
      body.removeChild(paragraph);
      continue;
    }
    for (const field of Array.from(
      paragraph.getElementsByTagNameNS(drawing, 'fld'),
    ))
      field.parentNode!.removeChild(field);
    for (const lineBreak of Array.from(
      paragraph.getElementsByTagNameNS(drawing, 'br'),
    ))
      lineBreak.parentNode!.removeChild(lineBreak);
    const runs = Array.from(paragraph.getElementsByTagNameNS(drawing, 'r'));
    let run = runs[0];
    if (!run) {
      run = paragraph.ownerDocument!.createElementNS(drawing, 'a:r');
      paragraph.insertBefore(
        run,
        paragraph.getElementsByTagNameNS(drawing, 'endParaRPr')[0] ?? null,
      );
    }
    for (const extra of runs.slice(1)) paragraph.removeChild(extra);
    let text = run.getElementsByTagNameNS(drawing, 't')[0];
    if (!text) {
      text = paragraph.ownerDocument!.createElementNS(drawing, 'a:t');
      run.appendChild(text);
    }
    text.textContent = values[index];
  }
}
