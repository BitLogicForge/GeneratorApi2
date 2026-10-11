import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import JSZip from 'jszip';

import { fillCategoryChart } from '@/pptx/jszip/charts';
import { findNamedObjects } from '@/pptx/jszip/objects';
import { chartNs, relationshipNs } from '@/pptx/jszip/package/namespaces';
import { readXml } from '@/pptx/jszip/package/read-xml';
import { resolveRelationship } from '@/pptx/jszip/package/resolve-relationship';
import { duplicateSlide } from '@/pptx/jszip/slides/duplicate';
import { listSlides } from '@/pptx/jszip/slides/list';
import { removeSlide } from '@/pptx/jszip/slides/remove';

import { chartPath, loadTemplate } from './fixtures.ts';

test('duplicated slide has independent editable chart/workbook and removable deck entry', async () => {
  const sourceBytes = await readFile('templates/daa.pptx');
  const zip = await loadTemplate();
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
