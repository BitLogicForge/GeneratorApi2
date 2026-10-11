import { posix } from 'node:path';

import { invalidTemplate } from '@/pptx/jszip/package/invalid-template';
import { packageNs, relationshipNs } from '@/pptx/jszip/package/namespaces';
import { writeXml } from '@/pptx/jszip/package/write-xml';

import { copySlideParts } from './copy-parts.ts';
import { deck } from './deck.ts';

import type JSZip from 'jszip';

/** Inserts after the source. Copies mutable charts, embedded files and notes, sharing layouts/media. */
export async function duplicateSlide(
  zip: JSZip,
  sourcePath: string,
): Promise<string> {
  const presentation = await deck(zip);
  const source = presentation.entries.find(
    (entry) => entry.path === sourcePath,
  );
  if (!source) throw invalidTemplate();
  const { output, staged, contentTypes } = await copySlideParts(
    zip,
    sourcePath,
  );
  const relation = source.relation.cloneNode(true) as typeof source.relation;
  const usedIds = new Set(
    Array.from(
      presentation.relationships.getElementsByTagNameNS(
        packageNs,
        'Relationship',
      ),
    ).map((item) => item.getAttribute('Id')),
  );
  let index = 1;
  while (usedIds.has(`rId${index}`)) index++;
  relation.setAttribute('Id', `rId${index}`);
  relation.setAttribute('Target', posix.relative('ppt', output));
  presentation.relationships.documentElement!.appendChild(relation);
  const slideId = source.element.cloneNode(true) as typeof source.element;
  slideId.setAttribute(
    'id',
    String(
      Math.max(
        255,
        ...presentation.entries.map((entry) =>
          Number(entry.element.getAttribute('id')),
        ),
      ) + 1,
    ),
  );
  slideId.setAttributeNS(relationshipNs, 'r:id', `rId${index}`);
  source.element.parentNode!.insertBefore(slideId, source.element.nextSibling);
  for (const [path, bytes] of staged)
    zip.file(path, bytes, { createFolders: false });
  writeXml(zip, '[Content_Types].xml', contentTypes);
  writeXml(zip, 'ppt/presentation.xml', presentation.document);
  writeXml(zip, 'ppt/_rels/presentation.xml.rels', presentation.relationships);
  return output;
}
