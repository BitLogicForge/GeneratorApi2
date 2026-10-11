import { posix } from 'node:path';

import { XMLSerializer } from '@xmldom/xmldom';

import { invalidTemplate } from '@/pptx/jszip/package/invalid-template';
import { contentNs, packageNs } from '@/pptx/jszip/package/namespaces';
import { readXml } from '@/pptx/jszip/package/read-xml';
import { relsPath } from '@/pptx/jszip/package/relationship-path';
import { targetPath } from '@/pptx/jszip/package/target-path';

import type JSZip from 'jszip';

export async function copySlideParts(zip: JSZip, sourcePath: string) {
  const contentTypes = await readXml(zip, '[Content_Types].xml');
  const copies = new Map<string, string>();
  const staged = new Map<string, string | Buffer>();
  const allocate = (path: string) => {
    const extension = posix.extname(path);
    const stem = path.slice(0, -extension.length).replace(/\d+$/, '');
    let index = 1;
    while (
      zip.file(`${stem}${index}${extension}`) ||
      staged.has(`${stem}${index}${extension}`) ||
      Array.from(copies.values()).includes(`${stem}${index}${extension}`)
    )
      index++;
    return `${stem}${index}${extension}`;
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
        if (relation.getAttribute('TargetMode') === 'External') continue;
        const target = targetPath(path, relation.getAttribute('Target') ?? '');
        const type = relation.getAttribute('Type')?.split('/').at(-1);
        // Notes point back to their owning slide. Other slide hyperlinks stay unchanged.
        const outputTarget =
          copies.get(target) ??
          (['chart', 'package', 'notesSlide'].includes(type ?? '')
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
