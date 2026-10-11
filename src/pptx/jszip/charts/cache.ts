import type { Element } from '@xmldom/xmldom';
import { chartNs, invalidTemplate } from '@/pptx/jszip/package';

export function fillCache(cache: Element, values: (string | number)[]) {
  const document = cache.ownerDocument!;
  const count = cache.getElementsByTagNameNS(chartNs, 'ptCount')[0];
  if (!count) throw invalidTemplate();
  count.setAttribute('val', String(values.length));
  const levels = Array.from(cache.getElementsByTagNameNS(chartNs, 'lvl'));
  if (levels.length > 1) throw invalidTemplate();
  const container = levels[0] ?? cache;
  for (const point of Array.from(cache.getElementsByTagNameNS(chartNs, 'pt')))
    point.parentNode!.removeChild(point);
  const extension = container.getElementsByTagNameNS(chartNs, 'extLst')[0];
  for (const [index, value] of values.entries()) {
    const point = document.createElementNS(chartNs, 'c:pt');
    point.setAttribute('idx', String(index));
    const node = document.createElementNS(chartNs, 'c:v');
    node.textContent = String(value);
    point.appendChild(node);
    container.insertBefore(point, extension ?? null);
  }
}
