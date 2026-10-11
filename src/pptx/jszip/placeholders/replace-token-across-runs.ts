import type { Element } from '@xmldom/xmldom';

export function replaceTokenAcrossRuns(
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
