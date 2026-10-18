import { RelationshipType } from '@/pptx/jszip/package/constants';
import { packageNs } from '@/pptx/jszip/package/namespaces';
import { readXml } from '@/pptx/jszip/package/read-xml';
import { relsPath } from '@/pptx/jszip/package/relationship-path';
import { resolveRelationship } from '@/pptx/jszip/package/resolve-relationship';
import { listSlides } from '@/pptx/jszip/slides/list';

import type JSZip from 'jszip';

export async function findTextParts(zip: JSZip): Promise<Set<string>> {
  const files = new Set(await listSlides(zip));
  for (const slide of Array.from(files)) {
    const path = relsPath(slide);
    if (!zip.file(path)) continue;
    const relationships = await readXml(zip, path);
    for (const relation of Array.from(
      relationships.getElementsByTagNameNS(packageNs, 'Relationship'),
    )) {
      if (
        relation
          .getAttribute('Type')
          ?.endsWith(`/${RelationshipType.NotesSlide}`)
      )
        files.add(
          await resolveRelationship(
            zip,
            slide,
            relation.getAttribute('Id'),
            RelationshipType.NotesSlide,
          ),
        );
    }
  }
  return files;
}
