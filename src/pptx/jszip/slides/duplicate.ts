import { posix } from 'node:path';

import { PackagePath } from '@/pptx/jszip/package/constants';
import {
  packageNs,
  presentationNs,
  relationshipNs,
} from '@/pptx/jszip/package/namespaces';
import { writeXml } from '@/pptx/jszip/package/write-xml';

import { copySlideParts } from './copy-parts.ts';
import { deck } from './deck.ts';

import type JSZip from 'jszip';

const MIN_SLIDE_ID = 256;
const MAX_SLIDE_ID = 2147483647; // 2^31 - 1 (ST_SlideId is xsd:unsignedInt < 0x80000000)

/**
 * Inserts after the source. Copies mutable charts, embedded files and notes, sharing layouts/media.
 * @param zip The JSZip archive instance.
 * @param sourceSlide The slide path or 1-based index to duplicate.
 * @param count Number of times to duplicate the source slide (defaults to 1).
 * @returns An array of output paths for all newly created duplicate slides.
 */
export async function duplicateSlide(
  zip: JSZip,
  sourceSlide: string | number,
  count = 1,
): Promise<string[]> {
  if (count <= 0) return [];

  const presentation = await deck(zip);
  const source = presentation.findEntry(sourceSlide);
  const relsRoot = presentation.relationships.documentElement;
  if (!relsRoot) {
    throw new Error('Malformed presentation.xml.rels: missing documentElement');
  }

  const sldIdLst = source.element.parentNode;
  if (!sldIdLst) {
    throw new Error('Malformed presentation.xml: source <p:sldId> has no parent <p:sldIdLst>');
  }

  const createdOutputs: string[] = [];
  let currentSourceElement = source.element;

  for (let i = 0; i < count; i++) {
    const { output, staged, contentTypes } = await copySlideParts(zip, source.path);
    createdOutputs.push(output);

    // 1. Allocate a unique rId in ppt/_rels/presentation.xml.rels
    const existingRels = Array.from(
      presentation.relationships.getElementsByTagNameNS(packageNs, 'Relationship'),
    );
    const usedRIds = new Set(
      existingRels
        .map((item) => item.getAttribute('Id'))
        .filter((id): id is string => Boolean(id)),
    );

    let rIdNum = 1;
    while (usedRIds.has(`rId${rIdNum}`)) rIdNum++;
    const nextRId = `rId${rIdNum}`;

    const relation = source.relation.cloneNode(true) as typeof source.relation;
    relation.setAttribute('Id', nextRId);
    relation.setAttribute('Target', posix.relative('ppt', output));
    relsRoot.appendChild(relation);

    // 2. Allocate a valid, unique ST_SlideId (>= 256) across all sldId elements in presentation.xml
    const allSldIdElements = Array.from(
      presentation.document.getElementsByTagNameNS(presentationNs, 'sldId'),
    );
    let maxSlideId = MIN_SLIDE_ID - 1;
    for (const el of allSldIdElements) {
      const rawId = Number.parseInt(el.getAttribute('id') ?? '', 10);
      if (Number.isFinite(rawId) && rawId > maxSlideId) {
        maxSlideId = rawId;
      }
    }

    const nextSlideId = maxSlideId + 1;
    if (nextSlideId > MAX_SLIDE_ID) {
      throw new Error(`Slide ID overflow: ${nextSlideId} exceeds ST_SlideId maximum`);
    }

    // 3. Create a clean <p:sldId> without cloning extension lists (<p:extLst>)
    const slideId = source.element.cloneNode(false) as typeof source.element;
    slideId.setAttribute('id', String(nextSlideId));

    const existingRelAttr =
      source.element.getAttributeNodeNS(relationshipNs, 'id') ??
      source.element.getAttributeNode('r:id');
    const relQualifiedName = existingRelAttr?.name ?? 'r:id';

    if (source.element.hasAttribute('r:id') && !source.element.hasAttributeNS(relationshipNs, 'id')) {
      slideId.setAttribute('r:id', nextRId);
    } else {
      slideId.setAttributeNS(relationshipNs, relQualifiedName, nextRId);
    }

    // Insert after the previous insertion point so they maintain sequential order
    sldIdLst.insertBefore(slideId, currentSourceElement.nextSibling);
    currentSourceElement = slideId;

    // 4. Commit staged zip parts for this duplication iteration
    for (const [path, bytes] of staged) {
      zip.file(path, bytes, { createFolders: false });
    }

    writeXml(zip, PackagePath.ContentTypes, contentTypes);
  }

  writeXml(zip, PackagePath.Presentation, presentation.document);
  writeXml(zip, PackagePath.PresentationRels, presentation.relationships);

  return createdOutputs;
}