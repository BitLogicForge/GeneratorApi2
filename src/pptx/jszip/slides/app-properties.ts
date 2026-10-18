import { PackagePath } from '@/pptx/jszip/package/constants';
import {
  docPropsVTypesNs,
  extendedPropertiesNs,
} from '@/pptx/jszip/package/namespaces';
import { readXml } from '@/pptx/jszip/package/read-xml';
import { writeXml } from '@/pptx/jszip/package/write-xml';

import type JSZip from 'jszip';

/**
 * Adjusts slide count and slide title metadata in docProps/app.xml when slides are added or removed.
 */
export async function updateAppPropertiesSlideCount(
  zip: JSZip,
  delta: number,
  slideTitle?: string,
): Promise<void> {
  if (!zip.file(PackagePath.AppProperties)) return;

  const doc = await readXml(zip, PackagePath.AppProperties);
  const slidesEl = doc.getElementsByTagNameNS(
    extendedPropertiesNs,
    'Slides',
  )[0];
  if (slidesEl) {
    const current = Number(slidesEl.textContent) || 0;
    slidesEl.textContent = String(Math.max(1, current + delta));
  }

  const headingPairs = doc.getElementsByTagNameNS(
    extendedPropertiesNs,
    'HeadingPairs',
  )[0];
  if (headingPairs) {
    const variants = Array.from(
      headingPairs.getElementsByTagNameNS(docPropsVTypesNs, 'variant'),
    );
    for (let i = 0; i < variants.length; i++) {
      if (variants[i].textContent === 'Slide Titles') {
        const countEl = variants[i + 1]?.getElementsByTagNameNS(
          docPropsVTypesNs,
          'i4',
        )[0];
        if (countEl) {
          const current = Number(countEl.textContent) || 0;
          countEl.textContent = String(Math.max(0, current + delta));
        }
        break;
      }
    }
  }

  const titlesOfParts = doc.getElementsByTagNameNS(
    extendedPropertiesNs,
    'TitlesOfParts',
  )[0];
  if (titlesOfParts) {
    const vector = titlesOfParts.getElementsByTagNameNS(
      docPropsVTypesNs,
      'vector',
    )[0];
    if (vector) {
      const currentSize = Number(vector.getAttribute('size')) || 0;
      vector.setAttribute('size', String(Math.max(0, currentSize + delta)));
      if (delta > 0) {
        const newTitle = doc.createElementNS(docPropsVTypesNs, 'vt:lpstr');
        newTitle.textContent = slideTitle ?? 'Slide';
        vector.appendChild(newTitle);
      } else if (delta < 0) {
        const lastTitle = vector.lastChild;
        if (lastTitle) vector.removeChild(lastTitle);
      }
    }
  }

  writeXml(zip, PackagePath.AppProperties, doc);
}
