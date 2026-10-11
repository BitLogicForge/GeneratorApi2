import assert from 'node:assert/strict';
import { test } from 'node:test';

import { XMLSerializer } from '@xmldom/xmldom';

import { findNamedObjects } from '@/pptx/jszip/objects';
import { drawing, presentationNs } from '@/pptx/jszip/package/namespaces';
import { fillTable } from '@/pptx/jszip/tables/fill';

import { loadTemplate } from './fixtures.ts';

test('column resizing preserves headers, formatting and widths while resizing both dimensions', async () => {
  const zip = await loadTemplate();
  const { objects } = await findNamedObjects(zip, ['TAB100']);
  const element = objects.get('TAB100')!.element;
  const serializer = new XMLSerializer();
  const originalRows = Array.from(
    element.getElementsByTagNameNS(drawing, 'tr'),
  );
  const headers = originalRows.map((row) =>
    serializer.serializeToString(row.getElementsByTagNameNS(drawing, 'tc')[0]),
  );
  const headerCells = Array.from(
    originalRows[0].getElementsByTagNameNS(drawing, 'tc'),
  ).map((cell) => serializer.serializeToString(cell));
  const lastCell = originalRows
    .at(-1)!
    .getElementsByTagNameNS(drawing, 'tc')[3];
  const style = serializer.serializeToString(
    lastCell.getElementsByTagNameNS(drawing, 'tcPr')[0],
  );
  const runStyle = serializer.serializeToString(
    lastCell.getElementsByTagNameNS(drawing, 'rPr')[0],
  );
  const extent = element
    .getElementsByTagNameNS(presentationNs, 'xfrm')[0]
    .getElementsByTagNameNS(drawing, 'ext')[0];
  const oldWidth = Number(extent.getAttribute('cx'));
  const lastWidth = Number(
    element.getElementsByTagNameNS(drawing, 'gridCol')[3].getAttribute('w'),
  );

  fillTable(
    element,
    Array.from({ length: 5 }, () => [1, 2, 3, 4, 5]),
    {
      startRow: 1,
      startColumn: 1,
      resizeRows: true,
      resizeColumns: true,
    },
  );
  const rows = Array.from(element.getElementsByTagNameNS(drawing, 'tr'));
  assert.equal(rows.length, 6);
  assert.equal(element.getElementsByTagNameNS(drawing, 'gridCol').length, 6);
  assert.equal(Number(extent.getAttribute('cx')), oldWidth + 2 * lastWidth);
  for (const [index, row] of rows.entries()) {
    const cells = Array.from(row.getElementsByTagNameNS(drawing, 'tc'));
    assert.equal(cells.length, 6);
    assert.equal(
      serializer.serializeToString(cells[0]),
      headers[Math.min(index, headers.length - 1)],
    );
    if (index === 0) {
      assert.deepEqual(
        cells.map((cell) => serializer.serializeToString(cell)),
        [...headerCells, headerCells[3], headerCells[3]],
      );
    } else {
      assert.deepEqual(
        cells.slice(1).map((cell) =>
          Array.from(cell.getElementsByTagNameNS(drawing, 't'))
            .map((text) => text.textContent)
            .join(''),
        ),
        ['1', '2', '3', '4', '5'],
      );
    }
  }
  const addedCell = rows.at(-1)!.getElementsByTagNameNS(drawing, 'tc')[5];
  assert.equal(
    serializer.serializeToString(
      addedCell.getElementsByTagNameNS(drawing, 'tcPr')[0],
    ),
    style,
  );
  assert.equal(
    serializer.serializeToString(
      addedCell.getElementsByTagNameNS(drawing, 'rPr')[0],
    ),
    runStyle,
  );

  const removedWidth = Array.from(
    element.getElementsByTagNameNS(drawing, 'gridCol'),
  )
    .slice(2)
    .reduce((sum, col) => sum + Number(col.getAttribute('w')), 0);
  fillTable(element, [[9]], {
    startRow: 1,
    startColumn: 1,
    resizeRows: true,
    resizeColumns: true,
  });
  assert.equal(element.getElementsByTagNameNS(drawing, 'tr').length, 2);
  assert.equal(element.getElementsByTagNameNS(drawing, 'gridCol').length, 2);
  assert.equal(element.getElementsByTagNameNS(drawing, 'tc').length, 4);
  assert.equal(
    Number(extent.getAttribute('cx')),
    oldWidth + 2 * lastWidth - removedWidth,
  );
});

test('column resizing rejects ragged, empty and merged tables', async () => {
  const zip = await loadTemplate();
  const { objects } = await findNamedObjects(zip, ['TAB100']);
  const element = objects.get('TAB100')!.element;
  for (const data of [[], [[]], [[1], [1, 2]]]) {
    assert.throws(() => fillTable(element, data, { resizeColumns: true }), {
      code: 'INVALID_TEMPLATE',
    });
  }
  const rows = Array.from(element.getElementsByTagNameNS(drawing, 'tr'));
  const data = rows.map(() => [1, 2]);
  assert.throws(
    () => fillTable(element, data, { startColumn: 4, resizeColumns: true }),
    { code: 'INVALID_TEMPLATE' },
  );
  rows[0]
    .getElementsByTagNameNS(drawing, 'tc')[0]
    .setAttribute('gridSpan', '2');
  assert.throws(() => fillTable(element, data, { resizeColumns: true }), {
    code: 'INVALID_TEMPLATE',
  });
});

test('table resizing preserves headers and row styling', async () => {
  const zip = await loadTemplate();
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

for (const startRow of [0, 1]) {
  test(`table filling preserves first-column headers with startRow ${startRow}`, async () => {
    const zip = await loadTemplate();
    const { objects } = await findNamedObjects(zip, ['TAB100']);
    const element = objects.get('TAB100')!.element;
    const rows = Array.from(element.getElementsByTagNameNS(drawing, 'tr'));
    const serializer = new XMLSerializer();
    const before = rows.map((row) =>
      serializer.serializeToString(
        row.getElementsByTagNameNS(drawing, 'tc')[0],
      ),
    );
    const header = serializer.serializeToString(rows[0]);
    const data = rows.slice(startRow).map(() => ['New', 42, 'Value']);

    fillTable(element, data, { startRow, startColumn: 1 });

    for (const [index, row] of rows.entries()) {
      const cells = Array.from(row.getElementsByTagNameNS(drawing, 'tc'));
      assert.equal(serializer.serializeToString(cells[0]), before[index]);
      if (index < startRow) continue;
      assert.deepEqual(
        cells.slice(1).map((cell) =>
          Array.from(cell.getElementsByTagNameNS(drawing, 't'))
            .map((text) => text.textContent)
            .join(''),
        ),
        ['New', '42', 'Value'],
      );
    }
    if (startRow) assert.equal(serializer.serializeToString(rows[0]), header);
  });
}

test('table filling rejects invalid column offsets and mismatched data widths', async () => {
  const zip = await loadTemplate();
  const { objects } = await findNamedObjects(zip, ['TAB100']);
  const element = objects.get('TAB100')!.element;
  const rows = Array.from(element.getElementsByTagNameNS(drawing, 'tr'));
  for (const startColumn of [-1, 0.5, NaN, Infinity, 5]) {
    assert.throws(
      () =>
        fillTable(
          element,
          rows.map(() => [1, 2, 3]),
          { startColumn },
        ),
      { code: 'INVALID_TEMPLATE' },
    );
  }
  assert.throws(
    () =>
      fillTable(
        element,
        rows.map(() => [1, 2]),
        { startColumn: 1 },
      ),
    { code: 'INVALID_TEMPLATE' },
  );
});

test('table resizing preserves existing first-column headers', async () => {
  const zip = await loadTemplate();
  const { objects } = await findNamedObjects(zip, ['TAB100']);
  const element = objects.get('TAB100')!.element;
  const serializer = new XMLSerializer();
  const before = Array.from(element.getElementsByTagNameNS(drawing, 'tr')).map(
    (row) =>
      serializer.serializeToString(
        row.getElementsByTagNameNS(drawing, 'tc')[0],
      ),
  );
  fillTable(
    element,
    Array.from({ length: before.length + 1 }, () => [1, 2, 3]),
    {
      startColumn: 1,
      resizeRows: true,
    },
  );
  const after = Array.from(element.getElementsByTagNameNS(drawing, 'tr')).map(
    (row) =>
      serializer.serializeToString(
        row.getElementsByTagNameNS(drawing, 'tc')[0],
      ),
  );
  assert.deepEqual(after, [...before, before.at(-1)]);
  fillTable(element, [[9, 8, 7]], { startColumn: 1, resizeRows: true });
  const remaining = Array.from(element.getElementsByTagNameNS(drawing, 'tr'));
  assert.equal(remaining.length, 1);
  assert.equal(
    serializer.serializeToString(
      remaining[0].getElementsByTagNameNS(drawing, 'tc')[0],
    ),
    before[0],
  );
});
