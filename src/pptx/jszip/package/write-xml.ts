import { XMLSerializer } from '@xmldom/xmldom';

import { documentTextSchema } from '@/validation/schema';

import { invalidTemplate } from './invalid-template.ts';

import type { Document } from '@xmldom/xmldom';
import type JSZip from 'jszip';

/** Index of the first character rejected by `documentTextSchema`, for diagnostics. */
function findInvalidXmlCharacter(xml: string): number {
  let index = 0;
  for (const character of xml) {
    if (!documentTextSchema.safeParse(character).success) return index;
    index += character.length;
  }
  return -1;
}

export function writeXml(zip: JSZip, path: string, document: Document) {
  const xml = new XMLSerializer().serializeToString(document);
  if (!documentTextSchema.safeParse(xml).success) {
    const index = findInvalidXmlCharacter(xml);
    throw invalidTemplate(
      `Package part "${path}" contains a character XML 1.0 cannot represent (U+${xml.codePointAt(index)?.toString(16).toUpperCase().padStart(4, '0')} at offset ${index})`,
      { path, offset: index, context: xml.slice(Math.max(0, index - 80), index + 80) },
    );
  }
  zip.file(path, xml, {
    createFolders: false,
  });
}
