import type { Element } from '@xmldom/xmldom';

/** Replaces a character range across text run elements, preserving existing formatting. */
export function replaceRunRange(
  nodes: Element[],
  original: string[],
  start: number,
  end: number,
  replacement: string,
): void {
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
      current.slice(0, from) + (start >= nodeStart ? replacement : '') + current.slice(to);
  }
}
