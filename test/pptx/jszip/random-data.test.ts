import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import JSZip from 'jszip';

import { findNamedObjects } from '@/pptx/jszip/objects';
import {
  chartNs,
  drawing,
  relationshipNs,
} from '@/pptx/jszip/package/namespaces';
import { readXml } from '@/pptx/jszip/package/read-xml';
import { resolveRelationship } from '@/pptx/jszip/package/resolve-relationship';
import { templateFile } from '@/reports/template';
import { DaaPocPresentationService } from '@/services/jszip/daa-poc-presentation-service';
import { generateRandomData } from '@/utils/random-data';

test('generateRandomData supports different row and column counts with independent random cells', () => {
  for (const columns of [1, 3, 4]) {
    for (const rows of [1, 4, 5, 10, 20]) {
      const data = generateRandomData(rows, columns);
      assert.equal(data.length, rows);
      assert.equal(new Set(data).size, rows);
      for (const row of data) {
        assert.equal(row.length, columns);
        assert.ok(
          row.every(
            (value) => Number.isInteger(value) && value >= 1 && value <= 100,
          ),
        );
      }
    }
  }
});

test('generateRandomData rejects invalid dimensions', () => {
  for (const count of [0, -1, 1.5, NaN, Infinity]) {
    assert.throws(() => generateRandomData(count, 1), RangeError);
    assert.throws(() => generateRandomData(1, count), RangeError);
  }
});

test('DAA fills its table and all chart series without changing the source', async () => {
  const path = templateFile('daa.pptx');
  const before = await readFile(path);
  const output = await new DaaPocPresentationService(path).generate({
    TEXT_ME: 'Generated report',
  });
  const zip = await JSZip.loadAsync(output);
  const { objects } = await findNamedObjects(zip, ['TAB100', 'GGO']);
  const table = objects.get('TAB100');
  const rows = Array.from(table.element.getElementsByTagNameNS(drawing, 'tr'));
  assert.equal(rows.length, 4);
  for (const row of rows.slice(1)) {
    const cells = Array.from(row.getElementsByTagNameNS(drawing, 'tc'));
    assert.equal(cells.length, 4);
    for (const cell of cells) {
      const value = Number(
        cell.getElementsByTagNameNS(drawing, 't')[0].textContent,
      );
      assert.ok(Number.isInteger(value) && value >= 1 && value <= 100);
    }
  }
  const object = objects.get('GGO');
  const reference = object.element.getElementsByTagNameNS(chartNs, 'chart')[0];
  const chartPath = await resolveRelationship(
    zip,
    object.path,
    reference.getAttributeNS(relationshipNs, 'id'),
    'chart',
  );
  const chart = await readXml(zip, chartPath);
  const series = Array.from(chart.getElementsByTagNameNS(chartNs, 'ser'));
  assert.equal(series.length, 3);
  for (const item of series) {
    const values = Array.from(
      item
        .getElementsByTagNameNS(chartNs, 'val')[0]
        .getElementsByTagNameNS(chartNs, 'v'),
    );
    assert.equal(values.length, 20);
    assert.ok(
      values.every((node) => {
        const value = Number(node.textContent);
        return Number.isInteger(value) && value >= 1 && value <= 100;
      }),
    );
  }
  assert.deepEqual(await readFile(path), before);
});
