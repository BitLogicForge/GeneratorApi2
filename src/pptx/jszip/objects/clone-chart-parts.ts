import { posix } from 'node:path';

import { PackagePath, RelationshipType } from '@/pptx/jszip/package/constants';
import { invalidTemplate } from '@/pptx/jszip/package/invalid-template';
import { chartNs, packageNs, relationshipNs } from '@/pptx/jszip/package/namespaces';
import { readXml } from '@/pptx/jszip/package/read-xml';
import { relsPath } from '@/pptx/jszip/package/relationship-path';
import { resolveRelationship } from '@/pptx/jszip/package/resolve-relationship';
import { writeXml } from '@/pptx/jszip/package/write-xml';
import { copySlideParts } from '@/pptx/jszip/slides/copy-parts';

import type { Element } from '@xmldom/xmldom';
import type JSZip from 'jszip';

/**
 * Copies the chart XML part, its relationships, and its embedded workbook
 * into independent package parts for a cloned chart element, allocating
 * a fresh relationship ID on the slide.
 */
export async function cloneChartParts(
  zip: JSZip,
  slidePath: string,
  clonedChartElement: Element,
): Promise<void> {
  const chartRef = clonedChartElement.getElementsByTagNameNS(chartNs, 'chart')[0];
  if (!chartRef) {
    throw invalidTemplate('Cloned element is not a chart');
  }

  const oldRelId = chartRef.getAttributeNS(relationshipNs, 'id');
  if (!oldRelId) {
    throw invalidTemplate('Chart reference is missing r:id');
  }

  const sourceChartPath = await resolveRelationship(
    zip,
    slidePath,
    oldRelId,
    RelationshipType.Chart,
  );

  const { output, staged, contentTypes } = await copySlideParts(zip, sourceChartPath);

  for (const [path, bytes] of staged) {
    zip.file(path, bytes, { createFolders: false });
  }
  writeXml(zip, PackagePath.ContentTypes, contentTypes);

  const slideRelsDoc = await readXml(zip, relsPath(slidePath));
  const usedIds = new Set(
    Array.from(slideRelsDoc.getElementsByTagNameNS(packageNs, 'Relationship')).map((item) =>
      item.getAttribute('Id'),
    ),
  );
  let index = 1;
  while (usedIds.has(`rId${index}`)) index++;
  const newRelId = `rId${index}`;

  const newRelation = slideRelsDoc.createElementNS(packageNs, 'Relationship');
  newRelation.setAttribute('Id', newRelId);
  newRelation.setAttribute('Type', `${relationshipNs}/${RelationshipType.Chart}`);
  newRelation.setAttribute('Target', posix.relative(posix.dirname(slidePath), output));
  slideRelsDoc.documentElement!.appendChild(newRelation);
  writeXml(zip, relsPath(slidePath), slideRelsDoc);

  chartRef.setAttributeNS(relationshipNs, 'r:id', newRelId);
}
