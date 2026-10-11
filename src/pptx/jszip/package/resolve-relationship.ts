import type JSZip from 'jszip';
import { relsPath } from './relationship-path.ts';
import { targetPath } from './target-path.ts';
import { readXml } from './read-xml.ts';
import { packageNs } from './namespaces.ts';
import { invalidTemplate } from './invalid-template.ts';

/** Follows a typed internal package relationship so callers need no hardcoded chart or workbook paths. */
export const resolveRelationship = async (
  archive: JSZip,
  owner: string,
  id: string | null,
  type: string,
) => {
  const relationships = await readXml(archive, relsPath(owner));
  const relation = Array.from(
    relationships.getElementsByTagNameNS(packageNs, 'Relationship'),
  ).find((item) => item.getAttribute('Id') === id);
  if (
    !id ||
    !relation ||
    relation.getAttribute('TargetMode') === 'External' ||
    !relation.getAttribute('Type')?.endsWith(`/${type}`)
  )
    throw invalidTemplate();
  const target = relation.getAttribute('Target');
  if (!target) throw invalidTemplate();
  const path = targetPath(owner, target);
  if (!archive.file(path)) throw invalidTemplate();
  return path;
};
