import { readFile } from 'node:fs/promises';

import JSZip from 'jszip';

import { SUPPORTED_CHART_TYPES } from '@/pptx/jszip/charts';
import { RelationshipType } from '@/pptx/jszip/package/constants';
import {
  chartNs,
  drawing,
  presentationNs,
  relationshipNs,
} from '@/pptx/jszip/package/namespaces';
import { readXml } from '@/pptx/jszip/package/read-xml';
import { resolveRelationship } from '@/pptx/jszip/package/resolve-relationship';
import { listSlides } from '@/pptx/jszip/slides/list';

import type { Element } from '@xmldom/xmldom';

const UPPERCASE_WITH_UNDERSCORE = /^[A-Z0-9]+(?:_[A-Z0-9]+)+$/;
const PLACEHOLDER_TOKEN = /\{\{[^{}]+\}\}/;

type ManipulableType = 'text' | 'table' | 'chart';

interface DiscoveredObject {
  key: string;
  name: string;
  slide: number;
  type: ManipulableType;
  replaceToken?: string;
}

function toCamelKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/_+([a-z0-9])/g, (_, char: string) => char.toUpperCase());
}

function extractText(element: Element): string {
  return Array.from(element.getElementsByTagNameNS(drawing, 't'))
    .map((node) => node.textContent ?? '')
    .join('');
}

async function detectManipulableType(
  zip: JSZip,
  slidePath: string,
  element: Element | undefined,
): Promise<ManipulableType | null> {
  if (!element) return null;

  if (element.localName === 'sp') {
    return element.getElementsByTagNameNS(drawing, 'p').length > 0
      ? 'text'
      : null;
  }

  if (element.localName === 'graphicFrame') {
    if (element.getElementsByTagNameNS(drawing, 'tbl').length > 0) {
      return 'table';
    }

    const chartReference = element.getElementsByTagNameNS(chartNs, 'chart')[0];
    if (!chartReference) return null;

    const relId = chartReference.getAttributeNS(relationshipNs, 'id') ?? null;
    try {
      const chartPath = await resolveRelationship(
        zip,
        slidePath,
        relId,
        RelationshipType.Chart,
      );
      const chartDoc = await readXml(zip, chartPath);
      const plotArea = chartDoc.getElementsByTagNameNS(chartNs, 'plotArea')[0];
      if (!plotArea) return null;

      const chartNodes = Array.from(plotArea.childNodes).filter(
        (node): node is Element =>
          node.nodeType === 1 &&
          node.namespaceURI === chartNs &&
          Boolean(node.localName?.endsWith('Chart')),
      );

      return chartNodes.length === 1 &&
        SUPPORTED_CHART_TYPES.has(chartNodes[0].localName ?? '')
        ? 'chart'
        : null;
    } catch {
      return null;
    }
  }

  return null;
}

const templatePath = process.argv[2] ?? 'templates/template_3.pptx';
const zip = await JSZip.loadAsync(await readFile(templatePath));
const slidePaths = await listSlides(zip);
const discovered: DiscoveredObject[] = [];
const nameCounts = new Map<string, number>();

for (const [index, slidePath] of slidePaths.entries()) {
  const slideNumber = index + 1;
  const document = await readXml(zip, slidePath);
  const propertiesList = Array.from(
    document.getElementsByTagNameNS(presentationNs, 'cNvPr'),
  );

  console.log(`Slide ${slideNumber} (${slidePath}):`);
  for (const properties of propertiesList) {
    const name = properties.getAttribute('name') ?? '';
    if (!UPPERCASE_WITH_UNDERSCORE.test(name)) continue;

    const element = properties.parentNode?.parentNode as Element | undefined;
    const type = await detectManipulableType(zip, slidePath, element);
    if (!type || !element) continue;

    const tokenMatch =
      type === 'text' ? PLACEHOLDER_TOKEN.exec(extractText(element)) : null;

    discovered.push({
      key: toCamelKey(name),
      name,
      slide: slideNumber,
      type,
      replaceToken: tokenMatch?.[0],
    });
    nameCounts.set(name, (nameCounts.get(name) ?? 0) + 1);

    console.log(`  - [${type}] ${name}`);
  }
}

const tables = discovered.filter((item) => item.type === 'table');
const charts = discovered.filter((item) => item.type === 'chart');
const texts = discovered.filter((item) => item.type === 'text');

const formatKey = (item: DiscoveredObject) =>
  (nameCounts.get(item.name) ?? 0) > 1
    ? `${item.key}Slide${item.slide}`
    : item.key;

const formatSlideProp = (item: DiscoveredObject) =>
  (nameCounts.get(item.name) ?? 0) > 1 ? `\n      slide: ${item.slide},` : '';

const lines: string[] = ['const templateSettings = {'];

if (tables.length > 0) {
  lines.push('  tables: {');
  for (const item of tables) {
    lines.push(
      `    ${formatKey(item)}: {\n      name: '${item.name}',${formatSlideProp(item)}\n      options: {\n        startRow: 1,\n      },\n    },`,
    );
  }
  lines.push('  },');
}

if (charts.length > 0) {
  lines.push('  charts: {');
  for (const item of charts) {
    lines.push(
      `    ${formatKey(item)}: {\n      name: '${item.name}',${formatSlideProp(item)}\n    },`,
    );
  }
  lines.push('  },');
}

if (texts.length > 0) {
  lines.push('  texts: {');
  for (const item of texts) {
    const optionsBlock = item.replaceToken
      ? `\n      options: {\n        replace: '${item.replaceToken}',\n      },`
      : '';
    lines.push(
      `    ${formatKey(item)}: {\n      name: '${item.name}',${formatSlideProp(item)}${optionsBlock}\n    },`,
    );
  }
  lines.push('  },');
}

lines.push('} satisfies TemplateSettings;');

console.log(`\n${lines.join('\n')}`);
