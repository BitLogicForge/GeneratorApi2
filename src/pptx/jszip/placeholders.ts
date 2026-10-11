import { posix } from 'node:path';

import { AppError } from '@/errors';
import { drawing } from '@/pptx/jszip/package/namespaces';
import { readXml } from '@/pptx/jszip/package/read-xml';
import { resolveRelationship } from '@/pptx/jszip/package/resolve-relationship';
import { writeXml } from '@/pptx/jszip/package/write-xml';
import { listSlides } from '@/pptx/jszip/slides/list';

import type { Element } from '@xmldom/xmldom';
import type JSZip from 'jszip';

const tokenPattern = /\{\{([A-Za-z][A-Za-z0-9_]{0,63})\}\}/g;
interface ReplacementUsage {
  used: Set<string>;
  missing: Set<string>;
}

async function findTextParts(zip: JSZip): Promise<Set<string>> {
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

function replaceTokenAcrossRuns(
  nodes: Element[],
  original: string[],
  match: RegExpMatchArray,
  replacement: string,
) {
  const start = match.index!;
  const end = start + match[0].length;
  let offset = 0;
  for (let n = 0; n < nodes.length; n++) {
    const nodeStart = offset;
    const nodeEnd = offset + original[n].length;
    offset = nodeEnd;
    if (nodeEnd <= start || nodeStart >= end) continue;
    const current = nodes[n].textContent ?? '';
    const from = Math.max(0, start - nodeStart);
    const to = Math.min(original[n].length, end - nodeStart);
    nodes[n].textContent =
      current.slice(0, from) +
      (start >= nodeStart ? replacement : '') +
      current.slice(to);
  }
}

function replaceParagraphTokens(
  paragraph: Element,
  replacements: Record<string, string>,
  usage: ReplacementUsage,
): boolean {
  const nodes = Array.from(paragraph.getElementsByTagNameNS(drawing, 't'));
  const original = nodes.map((node) => node.textContent ?? '');
  const matches = Array.from(original.join('').matchAll(tokenPattern));
  let changed = false;
  // Work backwards using original offsets, including tokens split across formatted runs.
  for (const match of matches.reverse()) {
    const key = match[1];
    if (!Object.hasOwn(replacements, key)) {
      usage.missing.add(key);
      continue;
    }
    usage.used.add(key);
    replaceTokenAcrossRuns(nodes, original, match, replacements[key]);
    changed = true;
  }
  return changed;
}

function validateReplacementUsage(
  replacements: Record<string, string>,
  { used, missing }: ReplacementUsage,
) {
  if (missing.size)
    throw new AppError(
      400,
      'MISSING_REPLACEMENTS',
      `Missing replacements: ${[...missing].join(', ')}`,
    );
  const unused = Object.keys(replacements).filter((key) => !used.has(key));
  if (unused.length)
    throw new AppError(
      400,
      'UNKNOWN_PLACEHOLDERS',
      `Template does not contain: ${unused.join(', ')}`,
    );
}

/** Replaces slide and note tokens across text runs while preserving formatting. */
export async function replacePlaceholders(
  zip: JSZip,
  replacements: Record<string, string>,
): Promise<void> {
  const usage: ReplacementUsage = { used: new Set(), missing: new Set() };
  for (const name of await findTextParts(zip)) {
    const document = await readXml(zip, name);
    let changed = false;
    const paragraphs = document.getElementsByTagNameNS(drawing, 'p');
    for (let i = 0; i < paragraphs.length; i++) {
      if (replaceParagraphTokens(paragraphs.item(i)!, replacements, usage))
        changed = true;
    }
    if (changed) writeXml(zip, name, document);
  }
  validateReplacementUsage(replacements, usage);
}
