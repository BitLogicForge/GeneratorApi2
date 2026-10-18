import { PackagePath } from '@/pptx/jszip/package/constants';
import { invalidTemplate } from '@/pptx/jszip/package/invalid-template';
import { relationshipNs } from '@/pptx/jszip/package/namespaces';
import { writeXml } from '@/pptx/jszip/package/write-xml';

import { updateAppPropertiesSlideCount } from './app-properties.ts';
import { deck } from './deck.ts';

import type JSZip from 'jszip';

/** Removes a slide from the deck. Retains package assets to preserve shared relationships. */
export async function removeSlide(
  zip: JSZip,
  slide: string | number,
): Promise<void> {
  const presentation = await deck(zip);
  if (presentation.entries.length < 2) throw invalidTemplate();
  const entry = presentation.findEntry(slide);
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
  writeXml(zip, PackagePath.Presentation, presentation.document);
  writeXml(zip, PackagePath.PresentationRels, presentation.relationships);
  await updateAppPropertiesSlideCount(zip, -1);
}
