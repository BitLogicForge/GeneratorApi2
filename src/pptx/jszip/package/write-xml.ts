import { XMLSerializer } from '@xmldom/xmldom';

import { documentTextSchema } from '@/validation/schema';

import { invalidTemplate } from './invalid-template.ts';

import type { Document } from '@xmldom/xmldom';
import type JSZip from 'jszip';

export function writeXml(zip: JSZip, path: string, document: Document) {
  const xml = new XMLSerializer().serializeToString(document);
  if (!documentTextSchema.safeParse(xml).success) throw invalidTemplate();
  zip.file(path, xml, {
    createFolders: false,
  });
}
