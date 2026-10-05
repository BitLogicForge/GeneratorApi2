import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import request from 'supertest';
import JSZip from 'jszip';
import { DOMParser } from '@xmldom/xmldom';
import { DaaPresentationService } from '../src/services/daa-presentation.js';
import { createApp } from '../src/app.js';

const template = fileURLToPath(
  new URL('../templates/daa.pptx', import.meta.url),
);
const drawing = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const chartNs = 'http://schemas.openxmlformats.org/drawingml/2006/chart';
const spreadsheet = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const workbookPath = 'ppt/embeddings/Microsoft_Excel_Worksheet.xlsx';
async function verifyData(bytes: Buffer) {
  const zip = await JSZip.loadAsync(bytes);
  const parse = async (archive: JSZip, name: string) =>
    new DOMParser().parseFromString(
      await archive.file(name)!.async('string'),
      'application/xml',
    );
  const slide = await parse(zip, 'ppt/slides/slide1.xml');
  const cells = Array.from(
    slide
      .getElementsByTagNameNS(drawing, 'tbl')[0]
      .getElementsByTagNameNS(drawing, 'tc'),
  );
  assert.equal(cells.length, 16);
  const values = cells.map((cell) =>
    Number(
      Array.from(cell.getElementsByTagNameNS(drawing, 't'))
        .map((text) => text.textContent)
        .join(''),
    ),
  );
  for (const value of values)
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
    assert.equal(points.length, 4);
    assert.equal(
      cache.getElementsByTagNameNS(chartNs, 'ptCount')[0].getAttribute('val'),
      '4',
    );
    for (const point of points) {
      const index = Number(point.getAttribute('idx'));
      const expected = values[index * 4 + seriesIndex + 1];
      assert.equal(
        Number(point.getElementsByTagNameNS(chartNs, 'v')[0].textContent),
        expected,
      );
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
  return { zip, workbook, values };
}

test('DAA updates all table cells and synchronizes chart cache with editable workbook', async () => {
  const source = await readFile(template);
  const original = await JSZip.loadAsync(source);
  let next = 0;
  const result = await new DaaPresentationService(
    template,
    () => ++next,
  ).generate();
  const { zip, workbook, values } = await verifyData(result);
  assert.deepEqual(
    values,
    Array.from({ length: 16 }, (_, index) => index + 1),
  );
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
      !originalWorkbook.files[name].dir && name !== 'xl/worksheets/sheet1.xml',
  )) {
    assert.deepEqual(
      await workbook.file(name)!.async('nodebuffer'),
      await originalWorkbook.file(name)!.async('nodebuffer'),
      name,
    );
  }
  // The chart's category labels, series names, formulas and styles remain as authored.
  const parseChart = async (archive: JSZip) =>
    new DOMParser().parseFromString(
      await archive.file('ppt/charts/chart1.xml')!.async('string'),
      'application/xml',
    );
  const before = await parseChart(original);
  const after = await parseChart(zip);
  for (const tag of ['strCache', 'f', 'spPr']) {
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

test('GET /daa.pptx needs no parameters and returns random native table and chart data', async () => {
  const app = createApp({
    daaPresentations: new DaaPresentationService(template),
    pdf: { generate: async () => Buffer.alloc(0) },
    presentations: { generate: async () => Buffer.alloc(0) },
  });
  const response = await request(app)
    .get('/daa.pptx')
    .buffer(true)
    .parse((res, done) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => done(null, Buffer.concat(chunks)));
    })
    .expect(200);
  assert.match(response.headers['content-type'], /presentationml/);
  assert.match(response.headers['content-disposition'], /daa.pptx/);
  assert.equal(response.headers['cache-control'], 'no-store');
  await verifyData(response.body);
});

test('DAA rejects a template without the expected table and chart', async () => {
  const service = new DaaPresentationService(
    fileURLToPath(new URL('../templates/business.pptx', import.meta.url)),
  );
  await assert.rejects(service.generate(), { code: 'INVALID_TEMPLATE' });
});
