import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import JSZip from 'jszip';
import PptxGenJS from 'pptxgenjs';
import { replacePlaceholders } from '@/pptx/jszip/placeholders';
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

for (const type of ['bar', 'area', 'pie', 'doughnut', 'radar'] as const) {
  test(`fills native ${type} chart caches and editable workbook`, async () => {
    const pptx = new PptxGenJS();
    pptx
      .addSlide()
      .addChart(
        pptx.ChartType[type],
        [{ name: 'Sales', labels: ['A', 'B', 'C'], values: [1, 2, 3] }],
        { x: 1, y: 1, w: 5, h: 3, objectName: 'GGO' },
      );
    const zip = await JSZip.loadAsync(
      (await pptx.write({ outputType: 'nodebuffer' })) as Buffer,
    );
    const path = (await listSlides(zip))[0];
    const part = await chartPath(zip, path);
    const { objects } = await findNamedObjects(zip, ['GGO'], [path]);
    await fillCategoryChart(zip, objects.get('GGO')!, [[7]], {
      categories: ['Q1'],
      seriesNames: ['Revenue'],
    });
    const document = await readXml(zip, part);
    assert.equal(
      document.getElementsByTagNameNS(chartNs, `${type}Chart`).length,
      1,
    );
    assert.equal(
      document
        .getElementsByTagNameNS(chartNs, 'numCache')[0]
        .getElementsByTagNameNS(chartNs, 'v')[0].textContent,
      '7',
    );
    const workbookPath = await resolveRelationship(
      zip,
      part,
      document
        .getElementsByTagNameNS(chartNs, 'externalData')[0]
        .getAttributeNS(relationshipNs, 'id'),
      'package',
    );
    const workbook = await JSZip.loadAsync(
      await zip.file(workbookPath)!.async('nodebuffer'),
    );
    const sheet = await readXml(workbook, 'xl/worksheets/sheet1.xml');
    const cells = Array.from(
      sheet.getElementsByTagNameNS(
        'http://schemas.openxmlformats.org/spreadsheetml/2006/main',
        'c',
      ),
    );
    assert.ok(
      !cells.some((cell) =>
        ['A3', 'B3', 'A4', 'B4'].includes(cell.getAttribute('r') ?? ''),
      ),
    );
    assert.equal(
      cells.find((cell) => cell.getAttribute('r') === 'B1')!.textContent,
      'Revenue',
    );
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

test('removed slides do not require placeholder replacements and last slide cannot be removed', async () => {
  const pptx = new PptxGenJS();
  pptx.addSlide().addText('{{removed}}', { x: 1, y: 1, w: 3, h: 1 });
  pptx.addSlide().addText('{{kept}}', { x: 1, y: 1, w: 3, h: 1 });
  const zip = await JSZip.loadAsync(
    (await pptx.write({ outputType: 'nodebuffer' })) as Buffer,
  );
  const [removed, kept] = await listSlides(zip);
  await removeSlide(zip, removed);
  await replacePlaceholders(zip, { kept: 'Result' });
  assert.match(await zip.file(kept)!.async('string'), /Result/);
  await assert.rejects(removeSlide(zip, kept), { code: 'INVALID_TEMPLATE' });
});

test('notes are duplicated with a backlink to their new slide', async () => {
  const pptx = new PptxGenJS();
  const slide = pptx.addSlide();
  slide.addText('Title', { x: 1, y: 1, w: 3, h: 1 });
  slide.addNotes('Author notes');
  const zip = await JSZip.loadAsync(
    (await pptx.write({ outputType: 'nodebuffer' })) as Buffer,
  );
  const [source] = await listSlides(zip);
  const copy = await duplicateSlide(zip, source);
  const notePath = async (path: string) => {
    const relationships = await readXml(
      zip,
      path.replace('/slides/', '/slides/_rels/') + '.rels',
    );
    const relation = Array.from(
      relationships.getElementsByTagName('Relationship'),
    ).find((node) => node.getAttribute('Type')?.endsWith('/notesSlide'))!;
    return resolveRelationship(
      zip,
      path,
      relation.getAttribute('Id'),
      'notesSlide',
    );
  };
  const originalNotes = await notePath(source);
  const copiedNotes = await notePath(copy);
  assert.notEqual(copiedNotes, originalNotes);
  assert.match(await zip.file(copiedNotes)!.async('string'), /Author notes/);
  const relationships = await readXml(
    zip,
    copiedNotes.replace('/notesSlides/', '/notesSlides/_rels/') + '.rels',
  );
  const backlink = Array.from(
    relationships.getElementsByTagName('Relationship'),
  ).find((node) => node.getAttribute('Type')?.endsWith('/slide'))!;
  assert.equal(
    await resolveRelationship(
      zip,
      copiedNotes,
      backlink.getAttribute('Id'),
      'slide',
    ),
    copy,
  );
});
