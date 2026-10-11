import type { Element } from '@xmldom/xmldom';
import { drawing } from '@/pptx/jszip/package/namespaces';
import { invalidTemplate } from '@/pptx/jszip/package/invalid-template';

/** Uses the first text run for replacement content, retaining its formatting and clearing remaining runs. */
export function setText(element: Element, value: string) {
  const document = element.ownerDocument!;
  let texts = Array.from(element.getElementsByTagNameNS(drawing, 't'));
  if (!texts.length) {
    const paragraph = element.getElementsByTagNameNS(drawing, 'p')[0];
    if (!paragraph) throw invalidTemplate();
    const run = document.createElementNS(drawing, 'a:r');
    const endProperties = paragraph.getElementsByTagNameNS(
      drawing,
      'endParaRPr',
    )[0];
    if (endProperties) {
      const properties = document.createElementNS(drawing, 'a:rPr');
      for (const attribute of Array.from(endProperties.attributes))
        properties.setAttributeNS(
          attribute.namespaceURI,
          attribute.name,
          attribute.value,
        );
      run.appendChild(properties);
    }
    const node = document.createElementNS(drawing, 'a:t');
    run.appendChild(node);
    paragraph.insertBefore(run, endProperties ?? null);
    texts = [node];
  }
  texts[0].textContent = value;
  for (const node of texts.slice(1)) node.textContent = '';
}
