import { XMLSerializer } from '@xmldom/xmldom';

import type { Document } from '@xmldom/xmldom';
import type JSZip from 'jszip';

export function writeXml(zip: JSZip, path: string, document: Document) {
  zip.file(path, new XMLSerializer().serializeToString(document), {
    createFolders: false,
  });
}
