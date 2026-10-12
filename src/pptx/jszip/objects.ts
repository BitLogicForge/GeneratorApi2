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
  const availableNames = new Set<string>();
  for (const path of slidePaths ?? activeSlides) {
    if (!activeSlides.includes(path))
      throw invalidTemplate(`Slide is not part of the presentation: ${path}`);
    const document = await readXml(zip, path);
    slides.set(path, document);
    for (const properties of Array.from(
      document.getElementsByTagNameNS(presentationNs, 'cNvPr'),
    )) {
      const name = properties.getAttribute('name') ?? '';
      if (name) availableNames.add(name);
      if (!names.includes(name)) continue;
      const previous = objects.get(name);
      if (previous)
        throw invalidTemplate(
          `Duplicate object "${name}" in ${previous.path} and ${path}`,
        );
      const element = properties.parentNode?.parentNode as Element | undefined;
      if (!element || !['graphicFrame', 'sp'].includes(element.localName ?? ''))
        throw invalidTemplate(
          `Unsupported object "${name}" in ${path}: ${element?.localName ?? 'missing shape'}`,
        );
      objects.set(name, { path, element });
    }
  }

  const missing = names.filter((name) => !objects.has(name));
  if (missing.length)
    throw invalidTemplate(
      `Missing objects: ${missing.join(', ')}. Available objects: ${[...availableNames].join(', ') || '(none)'}`,
    );
  return { slides, objects };
}
