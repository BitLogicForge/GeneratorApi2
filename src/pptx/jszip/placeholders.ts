import type JSZip from 'jszip';
import { AppError } from '@/errors';
import { drawing, readXml, writeXml } from './package.ts';

const tokenPattern = /\{\{([A-Za-z][A-Za-z0-9_]{0,63})\}\}/g;

/** Replaces slide and note tokens across text runs while preserving formatting. */
export async function replacePlaceholders(
  zip: JSZip,
  replacements: Record<string, string>,
): Promise<void> {
  const used = new Set<string>();
  const missing = new Set<string>();
  const files = Object.keys(zip.files).filter((name) =>
    /^ppt\/(slides\/slide\d+|notesSlides\/notesSlide\d+)\.xml$/.test(name),
  );
  for (const name of files) {
    const document = await readXml(zip, name);
    let changed = false;
    const paragraphs = document.getElementsByTagNameNS(drawing, 'p');
    for (let i = 0; i < paragraphs.length; i++) {
      const nodes = Array.from(
        paragraphs.item(i)!.getElementsByTagNameNS(drawing, 't'),
      );
      const original = nodes.map((node) => node.textContent ?? '');
      const text = original.join('');
      const matches = Array.from(text.matchAll(tokenPattern));
      // Work backwards so earlier character offsets remain valid, including split text runs.
      for (const match of matches.reverse()) {
        const key = match[1];
        if (!Object.hasOwn(replacements, key)) {
          missing.add(key);
          continue;
        }
        used.add(key);
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
            (start >= nodeStart ? replacements[key] : '') +
            current.slice(to);
        }
        changed = true;
      }
    }
    if (changed) writeXml(zip, name, document);
  }
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
