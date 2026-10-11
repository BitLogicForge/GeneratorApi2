import { invalidTemplate } from '@/pptx/jszip/package/invalid-template';
import { drawing } from '@/pptx/jszip/package/namespaces';

import type { Element } from '@xmldom/xmldom';

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
