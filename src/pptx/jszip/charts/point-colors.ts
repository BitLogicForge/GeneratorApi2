import { DRAWING_FILL_TAGS } from '@/pptx/jszip/package/constants';
import { chartNs, drawing } from '@/pptx/jszip/package/namespaces';

import type { Element } from '@xmldom/xmldom';

/** Updates native point fills while retaining other point formatting. */
export function fillPointColors(series: Element, colors: string[]) {
  const document = series.ownerDocument!;
  const existing = Array.from(series.childNodes).filter(
    (node): node is Element =>
      node.nodeType === 1 &&
      node.namespaceURI === chartNs &&
      node.localName === 'dPt',
  );
  const points = new Map(
    existing.map((point) => [
      Number(
        point.getElementsByTagNameNS(chartNs, 'idx')[0]?.getAttribute('val'),
      ),
      point,
    ]),
  );
  for (const point of existing) series.removeChild(point);
  const following = Array.from(series.childNodes).find(
    (node) =>
      node.nodeType === 1 &&
      node.namespaceURI === chartNs &&
      [
        'dLbls',
        'trendline',
        'errBars',
        'cat',
        'val',
        'smooth',
        'shape',
        'extLst',
      ].includes(node.localName ?? ''),
  );
  for (const [index, color] of colors.entries()) {
    const point =
      points.get(index) ?? document.createElementNS(chartNs, 'c:dPt');
    if (!points.has(index)) {
      const idx = document.createElementNS(chartNs, 'c:idx');
      idx.setAttribute('val', String(index));
      point.appendChild(idx);
    }
    let properties = point.getElementsByTagNameNS(chartNs, 'spPr')[0];
    if (!properties) {
      properties = document.createElementNS(chartNs, 'c:spPr');
      const extension = Array.from(point.childNodes).find(
        (node) => node.localName === 'extLst',
      );
      point.insertBefore(properties, extension ?? null);
    }
    for (const child of Array.from(properties.childNodes)) {
      if (
        child.namespaceURI === drawing &&
        (DRAWING_FILL_TAGS as readonly string[]).includes(child.localName ?? '')
      )
        properties.removeChild(child);
    }
    const fill = document.createElementNS(drawing, 'a:solidFill');
    const rgb = document.createElementNS(drawing, 'a:srgbClr');
    rgb.setAttribute('val', color.toUpperCase());
    fill.appendChild(rgb);
    const afterFill = Array.from(properties.childNodes).find(
      (node) => node.nodeType === 1 && node.localName !== 'xfrm',
    );
    properties.insertBefore(fill, afterFill ?? null);
    series.insertBefore(point, following ?? null);
  }
}
