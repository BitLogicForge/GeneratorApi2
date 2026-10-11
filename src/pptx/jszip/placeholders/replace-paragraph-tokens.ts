import { drawing } from '@/pptx/jszip/package/namespaces';

import { replaceTokenAcrossRuns } from './replace-token-across-runs.ts';

import type { Element } from '@xmldom/xmldom';
import type { ReplacementUsage } from './types.ts';

const tokenPattern = /\{\{([A-Za-z][A-Za-z0-9_]{0,63})\}\}/g;

export function replaceParagraphTokens(
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
