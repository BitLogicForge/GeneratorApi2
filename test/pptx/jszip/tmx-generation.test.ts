import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import JSZip from 'jszip';
import request from 'supertest';

import { createApp } from '@/app';
import { fillCategoryChart } from '@/pptx/jszip/charts';
import { loadChartWorkbook } from '@/pptx/jszip/charts/load-workbook';
import { findNamedObjects } from '@/pptx/jszip/objects';
import {
  chartNs,
  relationshipNs,
  spreadsheet,
} from '@/pptx/jszip/package/namespaces';
import { readXml } from '@/pptx/jszip/package/read-xml';
import { resolveRelationship } from '@/pptx/jszip/package/resolve-relationship';
import { writeXml } from '@/pptx/jszip/package/write-xml';
import { createReportServices } from '@/reports/services';
import { templateFile } from '@/reports/template';
import { TmxPocPresentationService } from '@/services/jszip/tmx-poc-presentation-service';

async function chartWorkbook(zip: JSZip) {
  const { objects } = await findNamedObjects(zip, ['X_CHART_A']);
  const object = objects.get('X_CHART_A')!;
  const reference = object.element.getElementsByTagNameNS(chartNs, 'chart')[0];
  const path = await resolveRelationship(
    zip,
    object.path,
    reference.getAttributeNS(relationshipNs, 'id'),
    'chart',
  );
  const chart = await readXml(zip, path);
  return {
    object,
    chart,
    ...(await loadChartWorkbook(zip, chart, path, 'Sheet1')),
  };
}

for (const [endpoint, filename] of [
  ['tma', 'Tmp1.pptx'],
  ['tmb', 'Tmp2.pptx'],
]) {
  test(`${endpoint} generates editable date charts and leaves its source unchanged`, async () => {
    const path = templateFile(filename!);
    const before = await readFile(path);
    const result = await new TmxPocPresentationService(path, () => 42).generate(
      'Custom title',
    );
    const zip = await JSZip.loadAsync(result);
    const { objects } = await findNamedObjects(zip, ['X_T0']);
    assert.match(objects.get('X_T0')!.element.textContent!, /Custom title/);
    const { chart, sheet } = await chartWorkbook(zip);
    const categories = chart.getElementsByTagNameNS(chartNs, 'cat')[0];
    const cache = categories.getElementsByTagNameNS(chartNs, 'numCache')[0];
    assert.equal(
      cache.getElementsByTagNameNS(chartNs, 'ptCount')[0].getAttribute('val'),
      '20',
    );
    assert.equal(
      categories.getElementsByTagNameNS(chartNs, 'f')[0].textContent,
      'Sheet1!$A$2:$A$21',
    );
    const values = Array.from(cache.getElementsByTagNameNS(chartNs, 'v')).map(
      (item) => Number(item.textContent),
    );
    assert.equal(values.length, 20);
    assert.equal(values[0] - values[19], 19);
    assert.ok(chart.getElementsByTagNameNS(chartNs, 'dateAx').length);
    for (const [index, value] of values.entries()) {
      const cell = Array.from(
        sheet.getElementsByTagNameNS(spreadsheet, 'c'),
      ).find((node) => node.getAttribute('r') === `A${index + 2}`)!;
      assert.notEqual(cell.getAttribute('t'), 'inlineStr');
      assert.equal(
        Number(cell.getElementsByTagNameNS(spreadsheet, 'v')[0].textContent),
        value,
      );
    }
    assert.deepEqual(await readFile(path), before);
  });

  test(`${endpoint} returns a PPTX through its actual route`, async () => {
    const reports = createReportServices();
    const app = createApp({
      reports,
      pdf: { generate: async () => Buffer.alloc(0) },
      logger: { error() {} },
    });
    try {
      await reports.initialize();
      const response = await request(app)
        .get(`/pptx/${endpoint}`)
        .query({ TEXT_ME: 'Custom title' })
        .expect(200);
      assert.match(
        response.headers['content-type'],
        /presentationml.presentation/,
      );
      assert.match(
        response.headers['content-disposition'],
        new RegExp(`${endpoint}\\.pptx`),
      );
    } finally {
      await reports.close();
    }
  });
}

test('numeric category dates respect Excel leap-year compatibility and the workbook date system', async () => {
  for (const [date1904, categories, expected] of [
    [false, ['1900-01-01', '1900-03-01', '2024-02-29'], [1, 61, 45351]],
    [true, ['1904-01-01', '1904-01-02'], [0, 1]],
  ] as const) {
    const zip = await JSZip.loadAsync(
      await readFile(templateFile('Tmp1.pptx')),
    );
    const { object, workbook, workbookPath } = await chartWorkbook(zip);
    if (date1904) {
      const document = await readXml(workbook, 'xl/workbook.xml');
      const properties = document.getElementsByTagNameNS(
        spreadsheet,
        'workbookPr',
      )[0];
      properties.setAttribute('date1904', '1');
      writeXml(workbook, 'xl/workbook.xml', document);
      zip.file(
        workbookPath,
        await workbook.generateAsync({ type: 'nodebuffer' }),
      );
    }
    await fillCategoryChart(
      zip,
      object,
      categories.map(() => [42]),
      { categories: [...categories] },
    );
    const { chart } = await chartWorkbook(zip);
    const cache = chart
      .getElementsByTagNameNS(chartNs, 'cat')[0]
      .getElementsByTagNameNS(chartNs, 'numCache')[0];
    assert.deepEqual(
      Array.from(cache.getElementsByTagNameNS(chartNs, 'v')).map((item) =>
        Number(item.textContent),
      ),
      expected,
    );
  }
});

test('numeric categories reject text that is neither a number nor a valid date', async () => {
  const zip = await JSZip.loadAsync(await readFile(templateFile('Tmp1.pptx')));
  const { object } = await chartWorkbook(zip);
  await assert.rejects(
    fillCategoryChart(zip, object, [[42]], { categories: ['2027-02-29'] }),
    /Numeric chart categories require/,
  );
});
