import { posix } from 'node:path';

import { readXml } from '@/pptx/jszip/package/read-xml';
import { resolveRelationship } from '@/pptx/jszip/package/resolve-relationship';
import { listSlides } from '@/pptx/jszip/slides/list';

import type JSZip from 'jszip';

export async function findTextParts(zip: JSZip): Promise<Set<string>> {
  const files = new Set(await listSlides(zip));
  for (const slide of Array.from(files)) {
    const path = posix.join(
      posix.dirname(slide),
      '_rels',
      `${posix.basename(slide)}.rels`,
    );
    if (!zip.file(path)) continue;
    const relationships = await readXml(zip, path);
    for (const relation of Array.from(
      relationships.getElementsByTagNameNS(
        'http://schemas.openxmlformats.org/package/2006/relationships',
        'Relationship',
      ),
    )) {
      if (relation.getAttribute('Type')?.endsWith('/notesSlide'))
        files.add(
          await resolveRelationship(
            zip,
            slide,
            relation.getAttribute('Id'),
            'notesSlide',
          ),
        );
    }
  }
  return files;
}
