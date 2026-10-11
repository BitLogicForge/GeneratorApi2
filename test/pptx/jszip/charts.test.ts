import assert from 'node:assert/strict';
import { test } from 'node:test';

import { DOMParser } from '@xmldom/xmldom';
import JSZip from 'jszip';
import PptxGenJS from 'pptxgenjs';

import { fillCategoryChart } from '@/pptx/jszip/charts';
import { resizeWorkbookTables } from '@/pptx/jszip/charts/resize-workbook-tables';
import { findNamedObjects } from '@/pptx/jszip/objects';
import {
  chartNs,
  relationshipNs,
  spreadsheet,
} from '@/pptx/jszip/package/namespaces';
import { readXml } from '@/pptx/jszip/package/read-xml';
import { resolveRelationship } from '@/pptx/jszip/package/resolve-relationship';
import { writeXml } from '@/pptx/jszip/package/write-xml';
import { listSlides } from '@/pptx/jszip/slides/list';
import { setWorksheetCell } from '@/pptx/jszip/spreadsheet';

import { chartPath } from './fixtures.ts';

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

test('worksheet dimensions handle dedicated ranges, single cells, and implicit formatted cells', async () => {
  const fixtures = [
    {
      cells:
        '<row r="1"><c r="A1"/><c r="B1"/></row><row r="2"><c r="A2"/><c r="B2"/></row>',
      expected: 'A1:B2',
    },
    {
      cells: '<row r="1"><c r="A1"/></row><row r="21"><c r="B21"/></row>',
      expected: 'A1:B21',
    },
    {
      cells:
        '<row r="5"><c r="C5" s="0"/><c s="0"/></row><row><c s="0"/></row>',
      expected: 'A5:D6',
    },
    { cells: '<row r="7"><c r="D7"/></row>', expected: 'D7' },
    { cells: '', expected: 'A1' },
  ];
  for (const { cells, expected } of fixtures) {
    const sheet = new DOMParser().parseFromString(
      `<worksheet xmlns="${spreadsheet}"><dimension ref="A1:Z100"/><sheetData>${cells}</sheetData></worksheet>`,
      'application/xml',
    );
    const workbook = new JSZip();
    await resizeWorkbookTables(
      workbook,
      sheet,
      'xl/worksheets/sheet1.xml',
      'A',
      2,
      2,
    );
    writeXml(workbook, 'xl/worksheets/sheet1.xml', sheet);
    const output = await readXml(workbook, 'xl/worksheets/sheet1.xml');
    assert.equal(
      output
        .getElementsByTagNameNS(spreadsheet, 'dimension')[0]
        .getAttribute('ref'),
      expected,
    );
  }
});

test('chart resizing keeps all retained content and formatted cells inside worksheet dimensions', async () => {
  const pptx = new PptxGenJS();
  pptx
    .addSlide()
    .addChart(
      pptx.ChartType.bar,
      [{ name: 'Sales', labels: ['A', 'B', 'C'], values: [1, 2, 3] }],
      { x: 1, y: 1, w: 5, h: 3, objectName: 'GGO' },
    );
  const zip = await JSZip.loadAsync(
    (await pptx.write({ outputType: 'nodebuffer' })) as Buffer,
  );
  const slide = (await listSlides(zip))[0];
  const part = await chartPath(zip, slide);
  const chart = await readXml(zip, part);
  const workbookPath = await resolveRelationship(
    zip,
    part,
    chart
      .getElementsByTagNameNS(chartNs, 'externalData')[0]
      .getAttributeNS(relationshipNs, 'id'),
    'package',
  );
  const workbook = await JSZip.loadAsync(
    await zip.file(workbookPath)!.async('nodebuffer'),
  );
  const sheetPath = 'xl/worksheets/sheet1.xml';
  const sheet = await readXml(workbook, sheetPath);
  let dimension = sheet.getElementsByTagNameNS(spreadsheet, 'dimension')[0];
  if (!dimension) {
    dimension = sheet.createElementNS(spreadsheet, 'dimension');
    sheet.documentElement!.insertBefore(
      dimension,
      sheet.documentElement!.firstChild,
    );
  }
  setWorksheetCell(sheet, 'Z100', 'Keep this text');
  setWorksheetCell(sheet, 'AA120', '');
  const formatted = Array.from(
    sheet.getElementsByTagNameNS(spreadsheet, 'c'),
  ).find((cell) => cell.getAttribute('r') === 'AA120')!;
  while (formatted.firstChild) formatted.removeChild(formatted.firstChild);
  formatted.setAttribute('s', '0');
  dimension.setAttribute('ref', 'A1:AA120');
  writeXml(workbook, sheetPath, sheet);
  zip.file(workbookPath, await workbook.generateAsync({ type: 'nodebuffer' }));
  const { objects } = await findNamedObjects(zip, ['GGO']);
  for (const count of [1, 7, 1]) {
    await fillCategoryChart(
      zip,
      objects.get('GGO')!,
      Array.from({ length: count }, (_, i) => [i + 10]),
      { categories: Array.from({ length: count }, (_, i) => `Q${i + 1}`) },
    );
    const result = await JSZip.loadAsync(
      await zip.file(workbookPath)!.async('nodebuffer'),
    );
    const output = await readXml(result, sheetPath);
    assert.equal(
      output
        .getElementsByTagNameNS(spreadsheet, 'dimension')[0]
        .getAttribute('ref'),
      'A1:AA120',
    );
    const cells = Array.from(output.getElementsByTagNameNS(spreadsheet, 'c'));
    assert.equal(
      cells.find((cell) => cell.getAttribute('r') === 'Z100')!.textContent,
      'Keep this text',
    );
    assert.equal(
      cells
        .find((cell) => cell.getAttribute('r') === 'AA120')!
        .getAttribute('s'),
      '0',
    );
    assert.ok(
      !cells.some((cell) => cell.getAttribute('r') === `B${count + 2}`),
    );
  }
});

test('worksheet dimension updates reject malformed and out-of-range addresses', async () => {
  for (const cells of [
    '<row r="0"><c r="A1"/></row>',
    '<row r="1048577"><c r="A1"/></row>',
    '<row r="1"><c r="A0"/></row>',
    '<row r="1"><c r="XFE1"/></row>',
    '<row r="1"><c r="A1048577"/></row>',
  ]) {
    const sheet = new DOMParser().parseFromString(
      `<worksheet xmlns="${spreadsheet}"><dimension ref="A1"/><sheetData>${cells}</sheetData></worksheet>`,
      'application/xml',
    );
    await assert.rejects(
      resizeWorkbookTables(
        new JSZip(),
        sheet,
        'xl/worksheets/sheet1.xml',
        'A',
        2,
        2,
      ),
      { code: 'INVALID_TEMPLATE' },
    );
  }
});
