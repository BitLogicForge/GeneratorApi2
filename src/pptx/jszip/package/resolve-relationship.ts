import { TargetMode } from './constants.ts';
import { invalidTemplate } from './invalid-template.ts';
import { packageNs } from './namespaces.ts';
import { readXml } from './read-xml.ts';
import { relsPath } from './relationship-path.ts';
import { targetPath } from './target-path.ts';

import type JSZip from 'jszip';
import type { RelationshipType } from './constants.ts';

/** Follows a typed internal package relationship so callers need no hardcoded chart or workbook paths. */
export const resolveRelationship = async (
  archive: JSZip,
  owner: string,
  id: string | null,
  type: RelationshipType,
) => {
  const relationships = await readXml(archive, relsPath(owner));
  const relation = Array.from(relationships.getElementsByTagNameNS(packageNs, 'Relationship')).find(
    (item) => item.getAttribute('Id') === id,
  );
  if (!id) throw invalidTemplate(`"${owner}" has no ${type} relationship id`);
  if (!relation)
    throw invalidTemplate(`Relationship "${id}" (${type}) not found in ${relsPath(owner)}`);
  if (relation.getAttribute('TargetMode') === TargetMode.External)
    throw invalidTemplate(
      `Relationship "${id}" in ${relsPath(owner)} points to an external target`,
    );
  if (!relation.getAttribute('Type')?.endsWith(`/${type}`))
    throw invalidTemplate(
      `Relationship "${id}" in ${relsPath(owner)} has type "${relation.getAttribute('Type')}", expected ${type}`,
    );
  const target = relation.getAttribute('Target');
  if (!target) throw invalidTemplate(`Relationship "${id}" in ${relsPath(owner)} has no Target`);
  const path = targetPath(owner, target);
  if (!archive.file(path))
    throw invalidTemplate(
      `Relationship "${id}" in ${relsPath(owner)} targets missing part "${path}"`,
    );
  return path;
};
