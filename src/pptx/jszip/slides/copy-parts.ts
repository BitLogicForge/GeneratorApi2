import { posix } from 'node:path';

import { XMLSerializer } from '@xmldom/xmldom';

import {
  PackagePath,
  RelationshipType,
  TargetMode,
} from '@/pptx/jszip/package/constants';
import { invalidTemplate } from '@/pptx/jszip/package/invalid-template';
import { contentNs, packageNs } from '@/pptx/jszip/package/namespaces';
import { readXml } from '@/pptx/jszip/package/read-xml';
import { relsPath } from '@/pptx/jszip/package/relationship-path';
import { targetPath } from '@/pptx/jszip/package/target-path';

import type JSZip from 'jszip';

const COPIED_SLIDE_PART_TYPES: readonly string[] = [
  RelationshipType.Chart,
  RelationshipType.Package,
  RelationshipType.NotesSlide,
];

export async function copySlideParts(zip: JSZip, sourcePath: string) {
  const contentTypes = await readXml(zip, PackagePath.ContentTypes);
  const copies = new Map<string, string>();
  const staged = new Map<string, string | Buffer>();
  const allocate = (path: string) => {
    const extension = posix.extname(path);
    const stem = path.slice(0, -extension.length).replace(/\d+$/, '');
    const reserved = new Set(copies.values());
    let index = 1;
    let candidate = `${stem}${index}${extension}`;
    while (
      zip.file(candidate) ||
      staged.has(candidate) ||
      reserved.has(candidate)
    ) {
      index++;
      candidate = `${stem}${index}${extension}`;
    }
    return candidate;
  };
  const copy = async (path: string): Promise<string> => {
    const existing = copies.get(path);
    if (existing) return existing;
    const file = zip.file(path);
    if (!file) throw invalidTemplate();
    const output = allocate(path);
    copies.set(path, output);
    staged.set(output, await file.async('nodebuffer'));
    const override = Array.from(
      contentTypes.getElementsByTagNameNS(contentNs, 'Override'),
    ).find((item) => item.getAttribute('PartName') === `/${path}`);
    if (override) {
      const clone = override.cloneNode(true) as typeof override;
      clone.setAttribute('PartName', `/${output}`);
      contentTypes.documentElement!.appendChild(clone);
    }
    if (zip.file(relsPath(path))) {
      const relationships = await readXml(zip, relsPath(path));
      for (const relation of Array.from(
        relationships.getElementsByTagNameNS(packageNs, 'Relationship'),
      )) {
        if (relation.getAttribute('TargetMode') === TargetMode.External)
          continue;
        const target = targetPath(path, relation.getAttribute('Target') ?? '');
        const type = relation.getAttribute('Type')?.split('/').at(-1);
        // Notes point back to their owning slide. Other slide hyperlinks stay unchanged.
        const outputTarget =
          copies.get(target) ??
          (COPIED_SLIDE_PART_TYPES.includes(type ?? '')
            ? await copy(target)
            : target);
        relation.setAttribute(
          'Target',
          posix.relative(posix.dirname(output), outputTarget),
        );
      }
      staged.set(
        relsPath(output),
        new XMLSerializer().serializeToString(relationships),
      );
    }
    return output;
  };
  const output = await copy(sourcePath);
  return { output, staged, contentTypes };
}
