import { PackagePath, RelationshipType, TargetMode } from '@/pptx/jszip/package/constants';
import { invalidTemplate } from '@/pptx/jszip/package/invalid-template';
import { packageNs, presentationNs, relationshipNs } from '@/pptx/jszip/package/namespaces';
import { readXml } from '@/pptx/jszip/package/read-xml';
import { targetPath } from '@/pptx/jszip/package/target-path';

import type JSZip from 'jszip';

export async function deck(zip: JSZip) {
  const document = await readXml(zip, PackagePath.Presentation);
  const relationships = await readXml(zip, PackagePath.PresentationRels);
  const ids = Array.from(document.getElementsByTagNameNS(presentationNs, 'sldId'));
  const entries = ids.map((element) => {
    const relation = Array.from(
      relationships.getElementsByTagNameNS(packageNs, 'Relationship'),
    ).find((item) => item.getAttribute('Id') === element.getAttributeNS(relationshipNs, 'id'));
    const relationId = element.getAttributeNS(relationshipNs, 'id');
    if (!relation)
      throw invalidTemplate(
        `Slide id ${element.getAttribute('id')} references relationship "${relationId}" missing from ${PackagePath.PresentationRels}`,
      );
    if (
      !relation.getAttribute('Type')?.endsWith(`/${RelationshipType.Slide}`) ||
      relation.getAttribute('TargetMode') === TargetMode.External
    )
      throw invalidTemplate(
        `Relationship "${relationId}" is not an internal slide relationship (type "${relation.getAttribute('Type')}")`,
      );
    const path = targetPath(PackagePath.Presentation, relation.getAttribute('Target') ?? '');
    if (!zip.file(path)) throw invalidTemplate(`Slide part "${path}" is missing from the package`);
    return { path, element, relation };
  });
  const findEntry = (slide: string | number) => {
    const entry =
      typeof slide === 'number'
        ? Number.isInteger(slide) && slide >= 1
          ? entries[slide - 1]
          : undefined
        : entries.find((item) => item.path === slide);
    if (!entry)
      throw invalidTemplate(
        `Slide ${typeof slide === 'number' ? `number ${slide}` : `"${slide}"`} not found (presentation has ${entries.length} slides)`,
      );
    return entry;
  };
  return { document, relationships, entries, findEntry };
}
