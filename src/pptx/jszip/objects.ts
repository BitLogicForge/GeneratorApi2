import { invalidTemplate } from '@/pptx/jszip/package/invalid-template';
import { presentationNs } from '@/pptx/jszip/package/namespaces';
import { readXml } from '@/pptx/jszip/package/read-xml';
import { listSlides } from '@/pptx/jszip/slides/list';

import type { Element } from '@xmldom/xmldom';
import type JSZip from 'jszip';

export interface NamedObject {
  path: string;
  element: Element;
}

/** Finds objects by their PowerPoint Selection Pane names and rejects missing or ambiguous matches. */
export async function findNamedObjects(
  zip: JSZip,
  names: string[],
  slidePaths?: string[],
) {
  const slides = new Map<string, Awaited<ReturnType<typeof readXml>>>();
  const objects = new Map<string, { path: string; element: Element }>();
  const activeSlides = await listSlides(zip);
  for (const path of slidePaths ?? activeSlides) {
    if (!activeSlides.includes(path)) throw invalidTemplate();
    const document = await readXml(zip, path);
    slides.set(path, document);
    for (const properties of Array.from(
      document.getElementsByTagNameNS(presentationNs, 'cNvPr'),
    )) {
      const name = properties.getAttribute('name') ?? '';
      if (!names.includes(name)) continue;
      if (objects.has(name)) throw invalidTemplate();
      const element = properties.parentNode?.parentNode as Element | undefined;
      if (!element || !['graphicFrame', 'sp'].includes(element.localName ?? ''))
        throw invalidTemplate();
      objects.set(name, { path, element });
    }
  }

  for (const name of names) if (!objects.has(name)) throw invalidTemplate();
  return { slides, objects };
}
