import assert from 'node:assert/strict';
import { test } from 'node:test';

import JSZip from 'jszip';
import PptxGenJS from 'pptxgenjs';

import { fillCategoryChart } from '@/pptx/jszip/charts';
import { findNamedObjects } from '@/pptx/jszip/objects';
import { chartNs, relationshipNs } from '@/pptx/jszip/package/namespaces';
import { readXml } from '@/pptx/jszip/package/read-xml';
import { resolveRelationship } from '@/pptx/jszip/package/resolve-relationship';
import { listSlides } from '@/pptx/jszip/slides/list';

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
