import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import request from 'supertest';
import JSZip from 'jszip';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import { TemplateReportDemoService } from '../src/pptx/jszip/template-report-demo.js';
import { createApp } from '../src/app.js';

const template = fileURLToPath(
  new URL('../templates/daa.pptx', import.meta.url),
);
const drawing = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const chartNs = 'http://schemas.openxmlformats.org/drawingml/2006/chart';
const spreadsheet = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const workbookPath = 'ppt/embeddings/Microsoft_Excel_Worksheet.xlsx';
async function verifyData(bytes: Buffer, expectedText = 'Generated report') {
  const zip = await JSZip.loadAsync(bytes);
  const parse = async (archive: JSZip, name: string) =>
    new DOMParser().parseFromString(
      await archive.file(name)!.async('string'),
      'application/xml',
    );
  const slide = await parse(zip, 'ppt/slides/slide1.xml');
  const presentation =
    'http://schemas.openxmlformats.org/presentationml/2006/main';
  const properties = Array.from(
    slide.getElementsByTagNameNS(presentation, 'cNvPr'),
  );
  const table = properties.find(
    (node) => node.getAttribute('name') === 'TAB100',
  )!.parentNode!.parentNode! as import('@xmldom/xmldom').Element;
  const textShape = properties.find(
    (node) => node.getAttribute('name') === 'TEXT_ME',
  )!.parentNode!.parentNode! as import('@xmldom/xmldom').Element;
  assert.equal(
    Array.from(textShape.getElementsByTagNameNS(drawing, 't'))
      .map((node) => node.textContent)
      .join(''),
    expectedText,
  );
  const cells = Array.from(table.getElementsByTagNameNS(drawing, 'tc'));
  assert.equal(cells.length, 16);
  const values = cells.map((cell) =>
    Number(
      Array.from(cell.getElementsByTagNameNS(drawing, 't'))
        .map((text) => text.textContent)
        .join(''),
    ),
  );
  for (const value of values.slice(4))
    assert.ok(Number.isInteger(value) && value >= 1 && value <= 100);
  const chart = await parse(zip, 'ppt/charts/chart1.xml');
  assert.equal(chart.getElementsByTagNameNS(chartNs, 'lineChart').length, 1);
  const series = Array.from(chart.getElementsByTagNameNS(chartNs, 'ser'));
  assert.equal(series.length, 3);
  const workbook = await JSZip.loadAsync(
    await zip.file(workbookPath)!.async('nodebuffer'),
  );
  const sheet = await parse(workbook, 'xl/worksheets/sheet1.xml');
  const sheetCells = new Map(
    Array.from(sheet.getElementsByTagNameNS(spreadsheet, 'c')).map((cell) => [
      cell.getAttribute('r'),
      cell,
    ]),
  );
  for (const [seriesIndex, item] of series.entries()) {
    const cache = item.getElementsByTagNameNS(chartNs, 'numCache')[0];
    const points = Array.from(cache.getElementsByTagNameNS(chartNs, 'pt'));
    assert.equal(points.length, 20);
    assert.equal(
      cache.getElementsByTagNameNS(chartNs, 'ptCount')[0].getAttribute('val'),
      '20',
    );
    const valueFormula = item
      .getElementsByTagNameNS(chartNs, 'val')[0]
      .getElementsByTagNameNS(chartNs, 'f')[0];
    assert.equal(
      valueFormula.textContent,
      `Sheet1!$${String.fromCharCode(66 + seriesIndex)}$2:$${String.fromCharCode(66 + seriesIndex)}$21`,
    );
    const category = item.getElementsByTagNameNS(chartNs, 'cat')[0];
    assert.equal(
      category.getElementsByTagNameNS(chartNs, 'f')[0].textContent,
      'Sheet1!$A$2:$A$21',
    );
    const categoryPoints = Array.from(
      category.getElementsByTagNameNS(chartNs, 'pt'),
    );
    assert.equal(categoryPoints.length, 20);
    for (const [index, point] of categoryPoints.entries()) {
      assert.equal(
        point.getElementsByTagNameNS(chartNs, 'v')[0].textContent,
        `A${index + 1}`,
      );
      assert.equal(
        sheetCells
          .get(`A${index + 2}`)!
          .getElementsByTagNameNS(spreadsheet, 't')[0].textContent,
        `A${index + 1}`,
      );
    }
    for (const point of points) {
      const index = Number(point.getAttribute('idx'));
      const expected = Number(
        point.getElementsByTagNameNS(chartNs, 'v')[0].textContent,
      );
      assert.ok(Number.isInteger(expected) && expected >= 1 && expected <= 100);
      const cell = sheetCells.get(
        `${String.fromCharCode(66 + seriesIndex)}${index + 2}`,
      )!;
      assert.equal(
        Number(cell.getElementsByTagNameNS(spreadsheet, 'v')[0].textContent),
        expected,
      );
      assert.equal(cell.getAttribute('t'), null);
    }
  }
  assert.equal(
    sheet
      .getElementsByTagNameNS(spreadsheet, 'dimension')[0]
      .getAttribute('ref'),
    'A1:D21',
  );
  const excelTable = await parse(workbook, 'xl/tables/table1.xml');
  assert.equal(excelTable.documentElement!.getAttribute('ref'), 'A1:D21');
  return { zip, workbook, values };
}

test('Template report demo preserves table headers, fills the last three rows, and synchronizes chart data', async () => {
  const source = await readFile(template);
  const original = await JSZip.loadAsync(source);
  let next = 0;
  const result = await new TemplateReportDemoService(
    template,
    () => ++next,
  ).generate();
  const { zip, workbook, values } = await verifyData(result);
  assert.deepEqual(
    values.slice(4),
    Array.from({ length: 12 }, (_, index) => index + 1),
  );
  const header = async (archive: JSZip) => {
    const slide = new DOMParser().parseFromString(
      await archive.file('ppt/slides/slide1.xml')!.async('string'),
      'application/xml',
    );
    return slide
      .getElementsByTagNameNS(drawing, 'tbl')[0]
      .getElementsByTagNameNS(drawing, 'tr')[0]
      .toString();
  };
  assert.equal(await header(zip), await header(original));
  assert.deepEqual(
    Object.keys(zip.files).sort(),
    Object.keys(original.files).sort(),
  );
  const changed = new Set([
    'ppt/slides/slide1.xml',
    'ppt/charts/chart1.xml',
    workbookPath,
  ]);
  for (const name of Object.keys(original.files).filter(
    (name) => !original.files[name].dir && !changed.has(name),
  )) {
    assert.deepEqual(
      await zip.file(name)!.async('nodebuffer'),
      await original.file(name)!.async('nodebuffer'),
      name,
    );
  }
  const originalWorkbook = await JSZip.loadAsync(
    await original.file(workbookPath)!.async('nodebuffer'),
  );
  for (const name of Object.keys(originalWorkbook.files).filter(
    (name) =>
      !originalWorkbook.files[name].dir &&
      name !== 'xl/worksheets/sheet1.xml' &&
      name !== 'xl/tables/table1.xml',
  )) {
    assert.deepEqual(
      await workbook.file(name)!.async('nodebuffer'),
      await originalWorkbook.file(name)!.async('nodebuffer'),
      name,
    );
  }
  // Series names and styles remain as authored while data ranges expand.
  const parseChart = async (archive: JSZip) =>
    new DOMParser().parseFromString(
      await archive.file('ppt/charts/chart1.xml')!.async('string'),
      'application/xml',
    );
  const before = await parseChart(original);
  const after = await parseChart(zip);
  for (const tag of ['tx', 'spPr']) {
    assert.deepEqual(
      Array.from(after.getElementsByTagNameNS(chartNs, tag)).map((node) =>
        node.toString(),
      ),
      Array.from(before.getElementsByTagNameNS(chartNs, tag)).map((node) =>
        node.toString(),
      ),
    );
  }
  assert.deepEqual(await readFile(template), source);
});

test('GET /demo-report.pptx needs no parameters and returns random native table and chart data', async () => {
  const app = createApp({
    templateReportDemo: new TemplateReportDemoService(template),
    pdf: { generate: async () => Buffer.alloc(0) },
    presentations: { generate: async () => Buffer.alloc(0) },
  });
  const response = await request(app)
    .get('/demo-report.pptx')
    .buffer(true)
    .parse((res, done) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => done(null, Buffer.concat(chunks)));
    })
    .expect(200);
  assert.match(response.headers['content-type'], /presentationml/);
  assert.match(response.headers['content-disposition'], /demo-report.pptx/);
  assert.equal(response.headers['cache-control'], 'no-store');
  await verifyData(response.body);
});

test('Template report demo rejects a template without the expected table and chart', async () => {
  const service = new TemplateReportDemoService(
    fileURLToPath(new URL('../templates/business.pptx', import.meta.url)),
  );
  await assert.rejects(service.generate(), { code: 'INVALID_TEMPLATE' });
});

test('TEXT_ME query is escaped as literal text and invalid query values are rejected', async () => {
  const app = createApp({
    templateReportDemo: new TemplateReportDemoService(template),
    pdf: { generate: async () => Buffer.alloc(0) },
    presentations: { generate: async () => Buffer.alloc(0) },
  });
  const text = 'Revenue & growth <2026> — Żółć';
  const response = await request(app)
    .get('/demo-report.pptx')
    .query({ TEXT_ME: text })
    .buffer(true)
    .parse((res, done) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => done(null, Buffer.concat(chunks)));
    })
    .expect(200);
  await verifyData(response.body, text);
  await request(app)
    .get('/demo-report.pptx?TEXT_ME=one&TEXT_ME=two')
    .expect(400);
  await request(app)
    .get('/demo-report.pptx')
    .query({ TEXT_ME: 'x'.repeat(5001) })
    .expect(400);
});

test('named lookup ignores other tables and resolves renamed chart and workbook parts', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'template-report-names-'));
  try {
    const zip = await JSZip.loadAsync(await readFile(template));
    const ns = 'http://schemas.openxmlformats.org/presentationml/2006/main';
    const slide = new DOMParser().parseFromString(
      await zip.file('ppt/slides/slide1.xml')!.async('string'),
      'application/xml',
    );
    const tableProperties = Array.from(
      slide.getElementsByTagNameNS(ns, 'cNvPr'),
    ).find((node) => node.getAttribute('name') === 'TAB100')!;
    const frame = tableProperties.parentNode!.parentNode!;
    const clone = frame.cloneNode(true) as import('@xmldom/xmldom').Element;
    const cloneProperties = clone.getElementsByTagNameNS(ns, 'cNvPr')[0];
    cloneProperties.setAttribute('name', 'OtherTable');
    cloneProperties.setAttribute('id', '1000');
    frame.parentNode!.insertBefore(clone, frame);
    const untouchedTable = clone.toString();
    zip.file(
      'ppt/slides/slide1.xml',
      new XMLSerializer().serializeToString(slide),
      { createFolders: false },
    );
    const chartPart = await zip
      .file('ppt/charts/chart1.xml')!
      .async('nodebuffer');
    zip.file('ppt/charts/chart42.xml', chartPart, { createFolders: false });
    zip.remove('ppt/charts/chart1.xml');
    const slideRels = await zip
      .file('ppt/slides/_rels/slide1.xml.rels')!
      .async('string');
    zip.file(
      'ppt/slides/_rels/slide1.xml.rels',
      slideRels.replace('charts/chart1.xml', 'charts/chart42.xml'),
      { createFolders: false },
    );
    const chartRels = await zip
      .file('ppt/charts/_rels/chart1.xml.rels')!
      .async('string');
    zip.file(
      'ppt/charts/_rels/chart42.xml.rels',
      chartRels.replace('Microsoft_Excel_Worksheet.xlsx', 'renamed.xlsx'),
      { createFolders: false },
    );
    zip.remove('ppt/charts/_rels/chart1.xml.rels');
    zip.file(
      'ppt/embeddings/renamed.xlsx',
      await zip.file(workbookPath)!.async('nodebuffer'),
      { createFolders: false },
    );
    zip.remove(workbookPath);
    const path = join(dir, 'named.pptx');
    await writeFile(path, await zip.generateAsync({ type: 'nodebuffer' }));
    const result = await JSZip.loadAsync(
      await new TemplateReportDemoService(path).generate('Found by name'),
    );
    const outputSlide = new DOMParser().parseFromString(
      await result.file('ppt/slides/slide1.xml')!.async('string'),
      'application/xml',
    );
    const outputProperties = Array.from(
      outputSlide.getElementsByTagNameNS(ns, 'cNvPr'),
    ).find((node) => node.getAttribute('name') === 'OtherTable')!;
    assert.equal(
      outputProperties.parentNode!.parentNode!.toString(),
      untouchedTable,
    );
    assert.notDeepEqual(
      await result.file('ppt/charts/chart42.xml')!.async('nodebuffer'),
      chartPart,
    );
    const embedded = await JSZip.loadAsync(
      await result.file('ppt/embeddings/renamed.xlsx')!.async('nodebuffer'),
    );
    assert.match(
      await embedded.file('xl/worksheets/sheet1.xml')!.async('string'),
      /r="B2"><v>\d+<\/v>/,
    );
    // Duplicate names must fail rather than silently updating the wrong object.
    cloneProperties.setAttribute('name', 'TAB100');
    zip.file(
      'ppt/slides/slide1.xml',
      new XMLSerializer().serializeToString(slide),
      { createFolders: false },
    );
    await writeFile(path, await zip.generateAsync({ type: 'nodebuffer' }));
    await assert.rejects(new TemplateReportDemoService(path).generate(), {
      code: 'INVALID_TEMPLATE',
    });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
