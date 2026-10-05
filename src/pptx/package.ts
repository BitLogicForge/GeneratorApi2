import JSZip from 'jszip';
import { DOMParser, XMLSerializer, type Document } from '@xmldom/xmldom';
import { posix } from 'node:path';

export const drawing = 'http://schemas.openxmlformats.org/drawingml/2006/main';
export const chartNs = 'http://schemas.openxmlformats.org/drawingml/2006/chart';
export const spreadsheet =
  'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
export const presentationNs =
  'http://schemas.openxmlformats.org/presentationml/2006/main';
export const relationshipNs =
  'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
export const packageNs =
  'http://schemas.openxmlformats.org/package/2006/relationships';

export const readXml = async (archive: JSZip, path: string) => {
  const file = archive.file(path);
  return new DOMParser().parseFromString(
    await file!.async('string'),
    'application/xml',
  );
};

export const resolveRelationship = async (
  archive: JSZip,
  owner: string,
  id: string | null,
  type: string,
) => {
  const relationships = await readXml(
    archive,
    posix.join(posix.dirname(owner), '_rels', `${posix.basename(owner)}.rels`),
  );
  const relation = Array.from(
    relationships.getElementsByTagNameNS(packageNs, 'Relationship'),
  ).find((item) => item.getAttribute('Id') === id);
  const target = relation!.getAttribute('Target')!;
  const path = target.startsWith('/')
    ? target.slice(1)
    : posix.normalize(posix.join(posix.dirname(owner), target));
  return path;
};

export function writeXml(zip: JSZip, path: string, document: Document) {
  zip.file(path, new XMLSerializer().serializeToString(document), {
    createFolders: false,
  });
}
