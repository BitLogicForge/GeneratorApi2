import { RelationshipType, TargetMode } from '@/pptx/jszip/package/constants';
import { packageNs, presentationNs } from '@/pptx/jszip/package/namespaces';
import { readXml } from '@/pptx/jszip/package/read-xml';
import { relsPath } from '@/pptx/jszip/package/relationship-path';
import { targetPath } from '@/pptx/jszip/package/target-path';

import {
  findDirectTransformElement,
  parseTransformElementBounds,
} from './transform.ts';

import type { Document, Element } from '@xmldom/xmldom';
import type JSZip from 'jszip';
import type { ObjectBoundsEmu } from './types.ts';

async function resolveFirstRelationshipByType(
  zip: JSZip,
  sourcePath: string,
  expectedType: RelationshipType,
): Promise<string | undefined> {
  const relsFile = relsPath(sourcePath);
  if (!zip.file(relsFile)) return undefined;
  const relsDoc = await readXml(zip, relsFile);
  const relation = Array.from(
    relsDoc.getElementsByTagNameNS(packageNs, 'Relationship'),
  ).find(
    (item) =>
      item.getAttribute('TargetMode') !== TargetMode.External &&
      Boolean(item.getAttribute('Type')?.endsWith(`/${expectedType}`)),
  );
  const target = relation?.getAttribute('Target') ?? '';
  if (!target) return undefined;
  const resolved = targetPath(sourcePath, target);
  return zip.file(resolved) ? resolved : undefined;
}

function findPlaceholderShape(
  doc: Document,
  type: string | undefined,
  idx: string | undefined,
  allowMasterFallbacks = false,
): Element | undefined {
  const shapes = [
    ...Array.from(doc.getElementsByTagNameNS(presentationNs, 'sp')),
    ...Array.from(doc.getElementsByTagNameNS(presentationNs, 'pic')),
  ];
  const candidates = shapes
    .map((shape) => ({
      shape,
      ph: shape.getElementsByTagNameNS(presentationNs, 'ph')[0],
    }))
    .filter(
      (entry): entry is { shape: Element; ph: Element } =>
        entry.ph !== undefined,
    );

  if (idx !== undefined) {
    const byIdx = candidates.find(
      ({ ph }) => (ph.getAttribute('idx') || undefined) === idx,
    );
    if (byIdx) return byIdx.shape;
  }

  if (type !== undefined) {
    const byType = candidates.find(
      ({ ph }) => (ph.getAttribute('type') || undefined) === type,
    );
    if (byType) return byType.shape;

    if (allowMasterFallbacks) {
      const fallbackType =
        type === 'ctrTitle'
          ? 'title'
          : type === 'subTitle' || type === 'pic'
            ? 'body'
            : undefined;
      if (fallbackType) {
        const byFallback = candidates.find(
          ({ ph }) => (ph.getAttribute('type') || undefined) === fallbackType,
        );
        if (byFallback) return byFallback.shape;
      }
    }
  }

  if (allowMasterFallbacks && type === undefined) {
    const byBody = candidates.find(
      ({ ph }) => (ph.getAttribute('type') || undefined) === 'body',
    );
    if (byBody) return byBody.shape;
  }

  return undefined;
}

/**
 * Resolves the inherited 2D transform bounds (`x`, `y`, `cx`, `cy` in EMUs)
 * from `slideLayout` or `slideMaster` when a placeholder `<p:sp>` or `<p:pic>`
 * has no slide-local `<a:xfrm>`.
 */
export async function resolvePlaceholderBounds(
  zip: JSZip,
  slidePath: string,
  element: Element,
): Promise<ObjectBoundsEmu | undefined> {
  if (
    (element.localName !== 'sp' && element.localName !== 'pic') ||
    findDirectTransformElement(element)
  ) {
    return undefined;
  }

  const ph = element.getElementsByTagNameNS(presentationNs, 'ph')[0];
  if (!ph) return undefined;

  let type = ph.getAttribute('type') || undefined;
  const idx = ph.getAttribute('idx') || undefined;

  const layoutPath = await resolveFirstRelationshipByType(
    zip,
    slidePath,
    RelationshipType.SlideLayout,
  );
  if (!layoutPath) return undefined;

  const layoutDoc = await readXml(zip, layoutPath);
  const layoutShape = findPlaceholderShape(layoutDoc, type, idx, false);
  if (layoutShape) {
    const layoutXfrm = findDirectTransformElement(layoutShape);
    const layoutBounds = layoutXfrm && parseTransformElementBounds(layoutXfrm);
    if (layoutBounds) return layoutBounds;

    const layoutPh = layoutShape.getElementsByTagNameNS(
      presentationNs,
      'ph',
    )[0];
    type ??= layoutPh?.getAttribute('type') || undefined;
  }

  const masterPath = await resolveFirstRelationshipByType(
    zip,
    layoutPath,
    RelationshipType.SlideMaster,
  );
  if (!masterPath) return undefined;

  const masterDoc = await readXml(zip, masterPath);
  const masterShape = findPlaceholderShape(masterDoc, type, idx, true);
  const masterXfrm = masterShape && findDirectTransformElement(masterShape);
  return masterXfrm ? parseTransformElementBounds(masterXfrm) : undefined;
}
