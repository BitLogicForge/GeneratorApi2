import { resolvePlaceholderBounds } from '@/pptx/jszip/objects/placeholder-bounds';
import { invalidTemplate } from '@/pptx/jszip/package/invalid-template';
import { presentationNs } from '@/pptx/jszip/package/namespaces';
import { readXml } from '@/pptx/jszip/package/read-xml';
import { listSlides } from '@/pptx/jszip/slides/list';

import type { Element } from '@xmldom/xmldom';
import type JSZip from 'jszip';
import type { ObjectBoundsEmu } from '@/pptx/jszip/objects/types';

export interface NamedObject {
  path: string;
  element: Element;
  /** Inherited layout/master placeholder bounds in EMUs when `<p:spPr>` has no slide-local `<a:xfrm>` yet. */
  placeholderBounds?: ObjectBoundsEmu;
}

interface SlideObjects<Name extends string> {
  get(name: Name): NamedObject;
}

interface NamedObjects<Name extends string> {
  get(name: Name, slide?: string | number): NamedObject;
  inSlide(slide: string | number): SlideObjects<Name>;
}

/** Finds objects by their PowerPoint Selection Pane names and rejects missing or same-slide duplicate matches. */
export async function findNamedObjects<const Name extends string>(
  zip: JSZip,
  names: readonly Name[],
  slidePaths?: readonly (string | number)[],
) {
  const requestedNames: readonly string[] = names;
  const slides = new Map<string, Awaited<ReturnType<typeof readXml>>>();
  const byName = new Map<string, Map<string, NamedObject>>();
  const activeSlides = await listSlides(zip);
  const resolveActiveSlide = (slide: string | number): string => {
    const path =
      typeof slide === 'number'
        ? Number.isInteger(slide)
          ? activeSlides[slide - 1]
          : undefined
        : slide;
    if (!path || !activeSlides.includes(path))
      throw invalidTemplate(
        `Slide is not part of the presentation: ${String(slide)}`,
      );
    return path;
  };
  const availableNames = new Set<string>();
  for (const slide of slidePaths ?? activeSlides) {
    const path = resolveActiveSlide(slide);
    const document = await readXml(zip, path);
    slides.set(path, document);
    for (const properties of Array.from(
      document.getElementsByTagNameNS(presentationNs, 'cNvPr'),
    )) {
      const name = properties.getAttribute('name') ?? '';
      if (name) availableNames.add(name);
      if (!requestedNames.includes(name)) continue;
      let slideMatches = byName.get(name);
      if (!slideMatches) {
        slideMatches = new Map();
        byName.set(name, slideMatches);
      }
      if (slideMatches.has(path))
        throw invalidTemplate(`Duplicate object "${name}" in ${path}`);
      const element = properties.parentNode?.parentNode as Element | undefined;
      if (!element || !['graphicFrame', 'sp'].includes(element.localName ?? ''))
        throw invalidTemplate(
          `Unsupported object "${name}" in ${path}: ${element?.localName ?? 'missing shape'}`,
        );
      const placeholderBounds = await resolvePlaceholderBounds(
        zip,
        path,
        element,
      );
      slideMatches.set(path, {
        path,
        element,
        ...(placeholderBounds ? { placeholderBounds } : {}),
      });
    }
  }

  const missing = names.filter((name) => !byName.has(name));
  if (missing.length)
    throw invalidTemplate(
      `Missing objects: ${missing.join(', ')}. Available objects: ${[...availableNames].join(', ') || '(none)'}`,
    );

  const resolveSearchedSlide = (slide: string | number): string => {
    const path = resolveActiveSlide(slide);
    if (!slides.has(path))
      throw invalidTemplate(
        `Slide is not part of the searched presentation slides: ${String(slide)}`,
      );
    return path;
  };

  const objects: NamedObjects<Name> = {
    get(name: Name, slide?: string | number): NamedObject {
      const slideMatches = byName.get(name);
      if (!slideMatches)
        throw invalidTemplate(`Object "${name}" was not requested`);
      if (slide !== undefined) {
        const targetPath = resolveSearchedSlide(slide);
        const match = slideMatches.get(targetPath);
        if (!match)
          throw invalidTemplate(`Object "${name}" not found in ${targetPath}`);
        return match;
      }
      if (slideMatches.size > 1)
        throw invalidTemplate(
          `Ambiguous object "${name}" in ${[...slideMatches.keys()].join(' and ')}; specify a slide`,
        );
      return slideMatches.values().next().value!;
    },
    inSlide(slide: string | number): SlideObjects<Name> {
      const targetPath = resolveSearchedSlide(slide);
      return {
        get: (name: Name) => objects.get(name, targetPath),
      };
    },
  };

  return { slides, objects };
}
