import type JSZip from 'jszip';
import { posix } from 'node:path';
import { XMLSerializer } from '@xmldom/xmldom';
import {
  readXml,
  writeXml,
  presentationNs,
  relationshipNs,
  invalidTemplate,
} from './package.ts';

const packageNs =
  'http://schemas.openxmlformats.org/package/2006/relationships';
const contentNs =
  'http://schemas.openxmlformats.org/package/2006/content-types';
const relsPath = (path: string) =>
  posix.join(posix.dirname(path), '_rels', `${posix.basename(path)}.rels`);
const targetPath = (owner: string, target: string) =>
  target.startsWith('/')
    ? target.slice(1)
    : posix.normalize(posix.join(posix.dirname(owner), target));

async function deck(zip: JSZip) {
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

/** Actual presentation order, including hidden slides; paths are stable slide handles. */
export async function listSlides(zip: JSZip): Promise<string[]> {
  return (await deck(zip)).entries.map((entry) => entry.path);
}

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

/** Removes a slide from the deck. Retains package assets to preserve shared relationships. */
export async function removeSlide(zip: JSZip, path: string): Promise<void> {
  const presentation = await deck(zip);
  const entry = presentation.entries.find((item) => item.path === path);
  if (!entry || presentation.entries.length < 2) throw invalidTemplate();
  const id = entry.element.getAttribute('id');
  entry.element.parentNode!.removeChild(entry.element);
  entry.relation.parentNode!.removeChild(entry.relation);
  // Custom shows and PowerPoint section lists use the numeric slide ID.
  for (const node of Array.from(
    presentation.document.getElementsByTagName('*'),
  )) {
    if (
      (node.localName === 'sld' || node.localName === 'sldId') &&
      (node.getAttribute('id') === id ||
        node.getAttributeNS(relationshipNs, 'id') ===
          entry.relation.getAttribute('Id'))
    )
      node.parentNode!.removeChild(node);
  }
  writeXml(zip, 'ppt/presentation.xml', presentation.document);
  writeXml(zip, 'ppt/_rels/presentation.xml.rels', presentation.relationships);
}
