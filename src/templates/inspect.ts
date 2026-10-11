import { readFile } from 'node:fs/promises';
import { posix } from 'node:path';

import { DOMParser } from '@xmldom/xmldom';
import JSZip from 'jszip';

import { fillCategoryChart } from '@/pptx/jszip/charts';
import { findNamedObjects } from '@/pptx/jszip/objects';
import {
  chartNs,
  drawing,
  packageNs,
  presentationNs,
  relationshipNs,
} from '@/pptx/jszip/package/namespaces';
import { resolveRelationship } from '@/pptx/jszip/package/resolve-relationship';
import { targetPath } from '@/pptx/jszip/package/target-path';
import { listSlides } from '@/pptx/jszip/slides/list';
import { documentTextSchema } from '@/validation/document-text';

import type { Element } from '@xmldom/xmldom';
import type { TemplateDefinition } from './catalog.ts';

/** Reports authored content and validates relationships and objects used by a workflow. */
export async function inspectTemplate(
  path: string,
  definition: TemplateDefinition,
) {
  const source = await readFile(path);
  if (source.length > 20 * 1024 * 1024)
    throw new Error(`${definition.id}: template exceeds 20 MB`);
  const zip = await JSZip.loadAsync(source);
  const readXml = async (archive: JSZip, part: string) => {
    const file = archive.file(part);
    if (!file) throw new Error(`${definition.id}: missing XML part ${part}`);
    const xml = await file.async('string');
    if (!documentTextSchema.safeParse(xml).success)
      throw new Error(`${definition.id}: forbidden XML characters in ${part}`);
    return new DOMParser({
      onError: (_level, message) => {
        throw new Error(`${definition.id}: invalid XML in ${part}: ${message}`);
      },
    }).parseFromString(xml, 'application/xml');
  };
  if (!zip.file('[Content_Types].xml'))
    throw new Error(`${definition.id}: missing content types`);
  const slides = await listSlides(zip);
  const textParts = new Set(slides);
  for (const slide of slides) {
    const relations = posix.join(
      posix.dirname(slide),
      '_rels',
      `${posix.basename(slide)}.rels`,
    );
    if (!zip.file(relations)) continue;
    const document = await readXml(zip, relations);
    for (const relation of Array.from(
      document.getElementsByTagNameNS(packageNs, 'Relationship'),
    ))
      if (relation.getAttribute('Type')?.endsWith('/notesSlide'))
        textParts.add(
          await resolveRelationship(
            zip,
            slide,
            relation.getAttribute('Id'),
            'notesSlide',
          ),
        );
  }
  const placeholders = new Set<string>();
  const objects: { name: string; kind: string; slide: number }[] = [];
  const charts: { part: string; types: string[] }[] = [];
  const warnings: string[] = [];
  for (const part of Object.keys(zip.files).filter(
    (name) => !zip.files[name].dir && /\.(xml|rels)$/.test(name),
  )) {
    const document = await readXml(zip, part);
    if (part.endsWith('.rels')) {
      const owner =
        part === '_rels/.rels'
          ? ''
          : posix.join(
              posix.dirname(posix.dirname(part)),
              posix.basename(part, '.rels'),
            );
      if (owner && !zip.file(owner))
        throw new Error(
          `${definition.id}: relationship owner missing: ${owner}`,
        );
      const ids = new Set<string>();
      for (const relation of Array.from(
        document.getElementsByTagNameNS(packageNs, 'Relationship'),
      )) {
        const id = relation.getAttribute('Id');
        if (!id || ids.has(id))
          throw new Error(
            `${definition.id}: duplicate or missing relationship ID in ${part}`,
          );
        ids.add(id);
        if (relation.getAttribute('TargetMode') === 'External') continue;
        const target = relation.getAttribute('Target');
        if (!target || !zip.file(targetPath(owner, decodeURI(target))))
          throw new Error(
            `${definition.id}: broken relationship in ${part}: ${target}`,
          );
      }
    }
    if (part.endsWith('.xml')) {
      const relations = posix.join(
        posix.dirname(part),
        '_rels',
        `${posix.basename(part)}.rels`,
      );
      const documentRelations = zip.file(relations)
        ? await readXml(zip, relations)
        : undefined;
      const ids = new Set(
        documentRelations
          ? Array.from(
              documentRelations.getElementsByTagNameNS(
                packageNs,
                'Relationship',
              ),
            ).map((relation) => relation.getAttribute('Id'))
          : [],
      );
      for (const element of Array.from(document.getElementsByTagName('*')))
        for (const attribute of Array.from(element.attributes))
          if (
            attribute.namespaceURI === relationshipNs &&
            !ids.has(attribute.value)
          )
            throw new Error(
              `${definition.id}: missing relationship ${attribute.value} referenced by ${part}`,
            );
    }
    if (textParts.has(part)) {
      for (const paragraph of Array.from(
        document.getElementsByTagNameNS(drawing, 'p'),
      )) {
        const text = Array.from(paragraph.getElementsByTagNameNS(drawing, 't'))
          .map((node) => node.textContent ?? '')
          .join('');
        for (const match of text.matchAll(
          /\{\{([A-Za-z][A-Za-z0-9_]{0,63})\}\}/g,
        ))
          placeholders.add(match[1]);
      }
    }
    if (slides.includes(part)) {
      for (const property of Array.from(
        document.getElementsByTagNameNS(presentationNs, 'cNvPr'),
      )) {
        const element = property.parentNode?.parentNode as Element | undefined;
        if (
          !element ||
          !['sp', 'graphicFrame', 'pic', 'cxnSp'].includes(
            element.localName ?? '',
          )
        )
          continue;
        const kind = element.getElementsByTagNameNS(chartNs, 'chart').length
          ? 'chart'
          : element.getElementsByTagNameNS(drawing, 'tbl').length
            ? 'table'
            : element.localName === 'sp'
              ? 'text'
              : element.localName === 'pic'
                ? 'image'
                : 'connector';
        objects.push({
          name: property.getAttribute('name') ?? '',
          kind,
          slide: slides.indexOf(part) + 1,
        });
      }
    }
    const plot = document.getElementsByTagNameNS(chartNs, 'plotArea')[0];
    if (plot) {
      const types = Array.from(plot.childNodes)
        .filter(
          (node) => node.nodeType === 1 && node.localName?.endsWith('Chart'),
        )
        .map((node) => node.localName!);
      charts.push({ part, types });
      if (
        types.length !== 1 ||
        ![
          'lineChart',
          'barChart',
          'areaChart',
          'pieChart',
          'doughnutChart',
          'radarChart',
        ].includes(types[0])
      )
        warnings.push(
          `Chart ${part} is preserved but unsupported by the category-chart editing helper`,
        );
    }
  }
  for (const name of new Set(objects.map((object) => object.name)))
    if (objects.filter((object) => object.name === name).length > 1)
      warnings.push(`Duplicate object name: ${name}`);
  for (const name of definition.requiredPlaceholders)
    if (!placeholders.has(name))
      throw new Error(`${definition.id}: missing placeholder ${name}`);
  if (definition.mode === 'placeholders' && !placeholders.size)
    throw new Error(
      `${definition.id}: no supported slide or note placeholders`,
    );
  if (definition.mode === 'placeholders' && placeholders.size > 100)
    throw new Error(
      `${definition.id}: more than 100 placeholders cannot be filled by the request contract`,
    );
  const named = await findNamedObjects(
    zip,
    definition.requiredObjects.map((object) => object.name),
  );
  for (const required of definition.requiredObjects) {
    const matches = objects.filter((object) => object.name === required.name);
    if (matches.length !== 1 || matches[0].kind !== required.kind)
      throw new Error(
        `${definition.id}: required object ${required.name} must be a unique ${required.kind}`,
      );
    const object = named.objects.get(required.name)!;
    if (required.kind === 'table') {
      const table = object.element.getElementsByTagNameNS(drawing, 'tbl')[0];
      if (
        (required.rows &&
          table.getElementsByTagNameNS(drawing, 'tr').length !==
            required.rows) ||
        (required.columns &&
          table.getElementsByTagNameNS(drawing, 'gridCol').length !==
            required.columns)
      )
        throw new Error(
          `${definition.id}: table ${required.name} dimensions differ from catalog`,
        );
    }
    if (required.kind === 'chart') {
      if (!required.series)
        throw new Error(
          `${definition.id}: declare series count for ${required.name}`,
        );
      // Exercise the real helper on an in-memory copy, including workbook and formula checks.
      await fillCategoryChart(
        zip,
        object,
        [Array.from({ length: required.series }, () => 0)],
        { categories: ['Preflight'] },
      );
    }
  }
  return {
    slideCount: slides.length,
    placeholders: [...placeholders].sort(),
    objects,
    charts,
    warnings,
  };
}
