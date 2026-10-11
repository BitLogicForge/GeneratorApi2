import type JSZip from 'jszip';

import { writeXml } from '@/pptx/jszip/package/write-xml';
import { relationshipNs } from '@/pptx/jszip/package/namespaces';
import { invalidTemplate } from '@/pptx/jszip/package/invalid-template';
import { deck } from './deck.ts';

/** Removes a slide from the deck. Retains package assets to preserve shared relationships. */
export async function removeSlide(zip: JSZip, path: string): Promise<void> {
  const presentation = await deck(zip);
  const entry = presentation.entries.find((item) => item.path === path);
  if (!entry || presentation.entries.length < 2) throw invalidTemplate();
  const id = entry.element.getAttribute('id');
  entry.element.parentNode!.removeChild(entry.element);
  entry.relation.parentNode!.removeChild(entry.relation);
  // Custom shows and PowerPoint section lists use the numeric slide ID.
  for (const node of Array.from(
    presentation.document.getElementsByTagName('*'),
  )) {
    if (
      (node.localName === 'sld' || node.localName === 'sldId') &&
      (node.getAttribute('id') === id ||
        node.getAttributeNS(relationshipNs, 'id') ===
          entry.relation.getAttribute('Id'))
    )
      node.parentNode!.removeChild(node);
  }
  writeXml(zip, 'ppt/presentation.xml', presentation.document);
  writeXml(zip, 'ppt/_rels/presentation.xml.rels', presentation.relationships);
}
