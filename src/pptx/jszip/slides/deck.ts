import type JSZip from 'jszip';
import { readXml } from '@/pptx/jszip/package/read-xml';

import {
  presentationNs,
  relationshipNs,
  packageNs,
} from '@/pptx/jszip/package/namespaces';
import { invalidTemplate } from '@/pptx/jszip/package/invalid-template';
import { targetPath } from '@/pptx/jszip/package/target-path';

export async function deck(zip: JSZip) {
  const document = await readXml(zip, 'ppt/presentation.xml');
  const relationships = await readXml(zip, 'ppt/_rels/presentation.xml.rels');
  const ids = Array.from(
    document.getElementsByTagNameNS(presentationNs, 'sldId'),
  );
  const entries = ids.map((element) => {
    const relation = Array.from(
      relationships.getElementsByTagNameNS(packageNs, 'Relationship'),
    ).find(
      (item) =>
        item.getAttribute('Id') ===
        element.getAttributeNS(relationshipNs, 'id'),
    );
    if (
      !relation ||
      !relation.getAttribute('Type')?.endsWith('/slide') ||
      relation.getAttribute('TargetMode') === 'External'
    )
      throw invalidTemplate();
    const path = targetPath(
      'ppt/presentation.xml',
      relation.getAttribute('Target') ?? '',
    );
    if (!zip.file(path)) throw invalidTemplate();
    return { path, element, relation };
  });
  return { document, relationships, entries };
}
