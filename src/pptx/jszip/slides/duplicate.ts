import { posix } from 'node:path';

import { PackagePath } from '@/pptx/jszip/package/constants';
import {
  packageNs,
  presentationNs,
  relationshipNs,
} from '@/pptx/jszip/package/namespaces';
import { readXml } from '@/pptx/jszip/package/read-xml';
import { writeXml } from '@/pptx/jszip/package/write-xml';

import { copySlideParts } from './copy-parts.ts';
import { deck } from './deck.ts';

import type { Document } from '@xmldom/xmldom';
import type JSZip from 'jszip';

const MIN_SLIDE_ID = 256;
const MAX_SLIDE_ID = 2147483647;

const P14_CREATION_ID_URI = '{BB962C8B-B14F-4D97-AF65-F5344CB8AC3E}';
const A16_CREATION_ID_URI = '{FF2B5EF4-FFF2-40B4-BE49-F238E27FC236}';
const P14_MOD_ID_URI = '{D42A27DB-BD31-4B8C-83A1-F6EECF244321}';
const C16_UNIQUE_ID_URI = '{C3380CC4-5D6E-409C-BE32-E72D297353CC}';

const CHART_STYLE_REL_TYPE = 'http://schemas.microsoft.com/office/2011/relationships/chartStyle';
const CHART_COLOR_STYLE_REL_TYPE =
  'http://schemas.microsoft.com/office/2011/relationships/chartColorStyle';
const CHART_STYLE_CONTENT_TYPE = 'application/vnd.ms-office.chartstyle+xml';
const CHART_COLOR_STYLE_CONTENT_TYPE = 'application/vnd.ms-office.chartcolorstyle+xml';

function removeExtensionByUri(doc: Document, uris: ReadonlySet<string>): void {
  const allElements = Array.from(doc.getElementsByTagName('*'));
  for (const el of allElements) {
    if (
      el.localName === 'ext' ||
      el.tagName === 'p:ext' ||
      el.tagName === 'a:ext' ||
      el.tagName === 'c:ext'
    ) {
      const uri = el.getAttribute('uri');
      if (uri && uris.has(uri)) {
        const parent = el.parentNode;
        if (parent) {
          parent.removeChild(el);
          const hasElementChildren = Array.from(parent.childNodes).some(
            (node) => node.nodeType === 1,
          );
          if (!hasElementChildren && parent.parentNode) {
            parent.parentNode.removeChild(parent);
          }
        }
      }
    }
  }
}

function allocateNextPartPath(zip: JSZip, prefix: string, ext: string): string {
  let index = 1;
  while (zip.file(`${prefix}${index}${ext}`) !== null) {
    index++;
  }
  return `${prefix}${index}${ext}`;
}

function ensureContentTypeOverride(
  contentTypes: Document,
  partPath: string,
  contentType: string,
): void {
  const normalizedPartName = `/${partPath.replace(/^\/+/, '')}`;
  const overrides = Array.from(contentTypes.getElementsByTagName('Override'));
  const exists = overrides.some(
    (el) => el.getAttribute('PartName') === normalizedPartName,
  );
  if (exists) return;

  const root = contentTypes.documentElement;
  if (!root) return;

  const ns = root.namespaceURI ?? 'http://schemas.openxmlformats.org/package/2006/content-types';
  const override = contentTypes.createElementNS(ns, 'Override');
  override.setAttribute('PartName', normalizedPartName);
  override.setAttribute('ContentType', contentType);
  root.appendChild(override);
}

/**
 * Ensures each cloned chart has its own dedicated chartStyle (styleN.xml)
 * and chartColorStyle (colorsN.xml) parts rather than sharing them with the source chart.
 */
async function isolateClonedChartStyles(
  zip: JSZip,
  chartPath: string,
  contentTypes: Document,
): Promise<void> {
  const chartDir = posix.dirname(chartPath);
  const chartBase = posix.basename(chartPath);
  const chartRelsPath = posix.join(chartDir, '_rels', `${chartBase}.rels`);

  if (!zip.file(chartRelsPath)) return;

  const chartRelsDoc = await readXml(zip, chartRelsPath);
  const relElements = Array.from(
    chartRelsDoc.getElementsByTagNameNS(packageNs, 'Relationship'),
  );

  let modified = false;

  for (const rel of relElements) {
    const type = rel.getAttribute('Type');
    const target = rel.getAttribute('Target');
    if (!target) continue;

    if (type === CHART_STYLE_REL_TYPE) {
      const sourceStylePath = posix
        .normalize(posix.join(chartDir, target))
        .replace(/^\/+/, '');
      const sourceFile = zip.file(sourceStylePath);
      if (sourceFile) {
        const newStylePath = allocateNextPartPath(zip, 'ppt/charts/style', '.xml');
        const bytes = await sourceFile.async('uint8array');
        zip.file(newStylePath, bytes, { createFolders: false });
        rel.setAttribute('Target', posix.relative(chartDir, newStylePath));
        ensureContentTypeOverride(contentTypes, newStylePath, CHART_STYLE_CONTENT_TYPE);
        modified = true;
      }
    } else if (type === CHART_COLOR_STYLE_REL_TYPE) {
      const sourceColorPath = posix
        .normalize(posix.join(chartDir, target))
        .replace(/^\/+/, '');
      const sourceFile = zip.file(sourceColorPath);
      if (sourceFile) {
        const newColorPath = allocateNextPartPath(zip, 'ppt/charts/colors', '.xml');
        const bytes = await sourceFile.async('uint8array');
        zip.file(newColorPath, bytes, { createFolders: false });
        rel.setAttribute('Target', posix.relative(chartDir, newColorPath));
        ensureContentTypeOverride(
          contentTypes,
          newColorPath,
          CHART_COLOR_STYLE_CONTENT_TYPE,
        );
        modified = true;
      }
    }
  }

  if (modified) {
    writeXml(zip, chartRelsPath, chartRelsDoc);
  }
}

/** Inserts after the source. Copies mutable charts, embedded files and notes, sharing layouts/media. */
export async function duplicateSlide(
  zip: JSZip,
  sourceSlide: string | number,
): Promise<string> {
  const presentation = await deck(zip);
  const source = presentation.findEntry(sourceSlide);
  const { output, staged, contentTypes } = await copySlideParts(zip, source.path);

  // 1. Allocate a unique rId in ppt/_rels/presentation.xml.rels
  const relsRoot = presentation.relationships.documentElement;
  if (!relsRoot) {
    throw new Error('Malformed presentation.xml.rels: missing documentElement');
  }

  const existingRels = Array.from(
    presentation.relationships.getElementsByTagNameNS(packageNs, 'Relationship'),
  );
  const usedRIds = new Set(
    existingRels
      .map((item) => item.getAttribute('Id'))
      .filter((id): id is string => Boolean(id)),
  );

  let rIdNum = 1;
  while (usedRIds.has(`rId${rIdNum}`)) rIdNum++;
  const nextRId = `rId${rIdNum}`;

  const normalizedOutput = posix.normalize(output).replace(/^\/+/, '');
  const relativeTarget = posix.relative('ppt', normalizedOutput);

  const relation = source.relation.cloneNode(true) as typeof source.relation;
  relation.setAttribute('Id', nextRId);
  relation.setAttribute('Target', relativeTarget);
  relsRoot.appendChild(relation);

  // 2. Allocate a valid, unique ST_SlideId (>= 256) across all sldId elements in presentation.xml
  const allSldIdElements = Array.from(
    presentation.document.getElementsByTagNameNS(presentationNs, 'sldId'),
  );
  let maxSlideId = MIN_SLIDE_ID - 1;
  for (const el of allSldIdElements) {
    const rawId = Number.parseInt(el.getAttribute('id') ?? '', 10);
    if (Number.isFinite(rawId) && rawId > maxSlideId) {
      maxSlideId = rawId;
    }
  }

  const nextSlideId = maxSlideId + 1;
  if (nextSlideId > MAX_SLIDE_ID) {
    throw new Error(`Slide ID overflow: ${nextSlideId} exceeds ST_SlideId maximum`);
  }

  // 3. Create a clean <p:sldId> without cloning extension lists (<p:extLst>)
  const slideId = source.element.cloneNode(false) as typeof source.element;
  slideId.setAttribute('id', String(nextSlideId));

  const existingRelAttr =
    source.element.getAttributeNodeNS(relationshipNs, 'id') ??
    source.element.getAttributeNode('r:id');
  const relQualifiedName = existingRelAttr?.name ?? 'r:id';

  if (source.element.hasAttribute('r:id') && !source.element.hasAttributeNS(relationshipNs, 'id')) {
    slideId.setAttribute('r:id', nextRId);
  } else {
    slideId.setAttributeNS(relationshipNs, relQualifiedName, nextRId);
  }

  const sldIdLst = source.element.parentNode;
  if (!sldIdLst) {
    throw new Error('Malformed presentation.xml: source <p:sldId> has no parent <p:sldIdLst>');
  }
  sldIdLst.insertBefore(slideId, source.element.nextSibling);

  // 4. Commit staged zip parts and sanitize cloned slide/chart parts
  const slideTrackingUris = new Set([
    P14_CREATION_ID_URI,
    A16_CREATION_ID_URI,
    P14_MOD_ID_URI,
  ]);
  const chartTrackingUris = new Set([C16_UNIQUE_ID_URI]);
  const clonedCharts: string[] = [];

  for (const [partPath, bytes] of staged) {
    const normalizedPath = posix.normalize(partPath).replace(/^\/+/, '');
    zip.file(normalizedPath, bytes, { createFolders: false });

    if (/^ppt\/charts\/chart\d+\.xml$/.test(normalizedPath)) {
      clonedCharts.push(normalizedPath);
    }
  }

  // Strip duplicate tracking GUIDs from the cloned slide
  if (zip.file(normalizedOutput)) {
    const slideDoc = await readXml(zip, normalizedOutput);
    removeExtensionByUri(slideDoc, slideTrackingUris);
    writeXml(zip, normalizedOutput, slideDoc);
  }

  // Strip duplicate chart uniqueIds and isolate chartStyle / chartColorStyle parts
  for (const chartPath of clonedCharts) {
    const chartDoc = await readXml(zip, chartPath);
    removeExtensionByUri(chartDoc, chartTrackingUris);
    writeXml(zip, chartPath, chartDoc);

    await isolateClonedChartStyles(zip, chartPath, contentTypes);
  }

  writeXml(zip, PackagePath.ContentTypes, contentTypes);
  writeXml(zip, PackagePath.Presentation, presentation.document);
  writeXml(zip, PackagePath.PresentationRels, presentation.relationships);

  return output;
}