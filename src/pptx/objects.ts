import type JSZip from 'jszip';
import type { Element } from '@xmldom/xmldom';
import { readXml, presentationNs, invalidTemplate } from './package.js';

export interface NamedObject {
  path: string;
  element: Element;
}

export async function findNamedObjects(zip: JSZip, names: string[]) {
  const slides = new Map<string, Awaited<ReturnType<typeof readXml>>>();
  const objects = new Map<string, { path: string; element: Element }>();
  for (const path of Object.keys(zip.files).filter((name) =>
    /^ppt\/slides\/slide\d+\.xml$/.test(name),
  )) {
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
