import { replaceRunRange } from '@/pptx/jszip/text/replace-run-range';

import type { Element } from '@xmldom/xmldom';

export function replaceTokenAcrossRuns(
  nodes: Element[],
  original: string[],
  match: RegExpMatchArray,
  replacement: string,
) {
  const start = match.index!;
  const end = start + match[0].length;
  replaceRunRange(nodes, original, start, end, replacement);
}
