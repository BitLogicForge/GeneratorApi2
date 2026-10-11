import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import JSZip from 'jszip';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import { listSlides, duplicateSlide, removeSlide } from '@/pptx/jszip/slides';
import { findNamedObjects } from '@/pptx/jszip/objects';
import { fillCategoryChart } from '@/pptx/jszip/charts';
import { fillTable } from '@/pptx/jszip/text-table';
import { fillParagraphs, replaceParagraphText } from '@/pptx/jszip/paragraphs';
import {
  drawing,
  chartNs,
  readXml,
  resolveRelationship,
  relationshipNs,
} from '@/pptx/jszip/package';

const load = async () => JSZip.loadAsync(await readFile('templates/daa.pptx'));
const chartPath = async (zip: JSZip, path: string) => {
  const { objects } = await findNamedObjects(zip, ['GGO'], [path]);
  return resolveRelationship(
    zip,
    path,
    objects
      .get('GGO')!
      .element.getElementsByTagNameNS(chartNs, 'chart')[0]
      .getAttributeNS(relationshipNs, 'id'),
    'chart',
  );
};

test('duplicated slide has independent editable chart/workbook and removable deck entry', async () => {
  const sourceBytes = await readFile('templates/daa.pptx');
  const zip = await load();
  const originalOrder = await listSlides(zip);
  const source = originalOrder[0];
  const originalChart = await chartPath(zip, source);
  const chartBefore = await zip.file(originalChart)!.async('nodebuffer');
  const copy = await duplicateSlide(zip, source);
  assert.deepEqual(await listSlides(zip), [
    source,
    copy,
    ...originalOrder.slice(1),
  ]);
  const copiedChart = await chartPath(zip, copy);
  assert.notEqual(copiedChart, originalChart);
  const { objects } = await findNamedObjects(zip, ['GGO'], [copy]);
  await fillCategoryChart(
    zip,
    objects.get('GGO')!,
    [
      [1, 2, 3],
      [4, 5, 6],
    ],
    { categories: ['A', 'B'] },
  );
  assert.deepEqual(
    await zip.file(originalChart)!.async('nodebuffer'),
    chartBefore,
  );
  const chart = await readXml(zip, copiedChart);
  const workbookPath = await resolveRelationship(
    zip,
    copiedChart,
    chart
      .getElementsByTagNameNS(chartNs, 'externalData')[0]
      .getAttributeNS(relationshipNs, 'id'),
    'package',
  );
  assert.notEqual(
    workbookPath,
    'ppt/embeddings/Microsoft_Excel_Worksheet.xlsx',
  );
  const workbook = await JSZip.loadAsync(
    await zip.file(workbookPath)!.async('nodebuffer'),
  );
  assert.match(
    await workbook.file('xl/worksheets/sheet1.xml')!.async('string'),
    /r="B2"><v>1<\/v>/,
  );
  assert.equal(
    chart
      .getElementsByTagNameNS(chartNs, 'numCache')[0]
      .getElementsByTagNameNS(chartNs, 'ptCount')[0]
      .getAttribute('val'),
    '2',
  );
  await removeSlide(zip, source);
  assert.deepEqual(await listSlides(zip), [copy, ...originalOrder.slice(1)]);
  await findNamedObjects(zip, ['GGO']);
  const reopened = await JSZip.loadAsync(
    await zip.generateAsync({ type: 'nodebuffer' }),
  );
  assert.deepEqual(await listSlides(reopened), await listSlides(zip));
  assert.deepEqual(await readFile('templates/daa.pptx'), sourceBytes);
});

for (const type of [
  'barChart',
  'areaChart',
  'pieChart',
  'doughnutChart',
  'radarChart',
]) {
  test(`fills ${type} caches and workbook without changing series style`, async () => {
    const zip = await load();
    const path = (await listSlides(zip))[0];
    const part = await chartPath(zip, path);
    zip.file(
      part,
      (await zip.file(part)!.async('string')).replaceAll('lineChart', type),
    );
    const { objects } = await findNamedObjects(zip, ['GGO'], [path]);
    await fillCategoryChart(zip, objects.get('GGO')!, [[7, 8, 9]], {
      categories: ['Q1'],
    });
    const document = await readXml(zip, part);
    assert.equal(document.getElementsByTagNameNS(chartNs, type).length, 1);
    assert.equal(
      document
        .getElementsByTagNameNS(chartNs, 'numCache')[0]
        .getElementsByTagNameNS(chartNs, 'v')[0].textContent,
      '7',
    );
    assert.match(await zip.file(part)!.async('string'), /Sheet1!\$B\$2:\$B\$2/);
  });
}

test('paragraph edits preserve run properties, escape text, and do not cross paragraphs', () => {
  const document = new DOMParser().parseFromString(
    `<p:sp xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="${drawing}"><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:pPr lvl="1"/><a:r><a:rPr b="1"/><a:t>Hello {{cus</a:t></a:r><a:r><a:rPr i="1"/><a:t>tomer}}!</a:t></a:r></a:p><a:p><a:r><a:t>Another paragraph</a:t></a:r></a:p></p:txBody></p:sp>`,
    'application/xml',
  );
  const element = document.documentElement!;
  assert.equal(replaceParagraphText(element, '{{customer}}', 'A & B'), 1);
  assert.equal(replaceParagraphText(element, '!Another', 'no'), 0);
  assert.equal(
    element.getElementsByTagNameNS(drawing, 'rPr')[0].getAttribute('b'),
    '1',
  );
  assert.match(new XMLSerializer().serializeToString(document), /A &amp; B/);
  fillParagraphs(element, ['One', 'Two', 'Three']);
  assert.deepEqual(
    Array.from(element.getElementsByTagNameNS(drawing, 't')).map(
      (node) => node.textContent,
    ),
    ['One', 'Two', 'Three'],
  );
  fillParagraphs(element, ['Only']);
  assert.equal(element.getElementsByTagNameNS(drawing, 'p').length, 1);
  assert.equal(
    element.getElementsByTagNameNS(drawing, 'pPr')[0].getAttribute('lvl'),
    '1',
  );
});

test('table resizing preserves headers and row styling', async () => {
  const zip = await load();
  const { objects } = await findNamedObjects(zip, ['TAB100']);
  const element = objects.get('TAB100')!.element;
  const serializer = new XMLSerializer();
  const header = serializer.serializeToString(
    element.getElementsByTagNameNS(drawing, 'tr')[0],
  );
  fillTable(
    element,
    Array.from({ length: 5 }, () => [1, 2, 3, 4]),
    { startRow: 1, resizeRows: true },
  );
  assert.equal(element.getElementsByTagNameNS(drawing, 'tr').length, 6);
  assert.equal(
    serializer.serializeToString(
      element.getElementsByTagNameNS(drawing, 'tr')[0],
    ),
    header,
  );
  fillTable(element, [[9, 8, 7, 6]], { startRow: 1, resizeRows: true });
  assert.equal(element.getElementsByTagNameNS(drawing, 'tr').length, 2);
});
