import type JSZip from 'jszip';
import { XMLSerializer, type Document } from '@xmldom/xmldom';

export function writeXml(zip: JSZip, path: string, document: Document) {
  zip.file(path, new XMLSerializer().serializeToString(document), {
    createFolders: false,
  });
}
