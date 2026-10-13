import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import { XMLSerializer } from '@xmldom/xmldom';
import JSZip from 'jszip';

import { findNamedObjects } from '@/pptx/jszip/objects';
import { drawing, presentationNs } from '@/pptx/jszip/package/namespaces';
import { fillTable } from '@/pptx/jszip/tables/fill';

test('growing a native table preserves styles and original IDs and gives clones unique IDs', async () => {
  const path = new URL('../../../templates/daa.pptx', import.meta.url);
  const before = await readFile(path);
  const zip = await JSZip.loadAsync(before);
  const { objects } = await findNamedObjects(zip, ['TAB100']);
  const element = objects.get('TAB100')!.element;
  const namespace = 'http://schemas.microsoft.com/office/drawing/2014/main';
  const ids = (name: string) =>
    Array.from(element.getElementsByTagNameNS(namespace, name)).map((node) =>
      node.getAttribute('val'),
    );
  const rowIds = ids('rowId');
  const colIds = ids('colId');
  const rows = () => Array.from(element.getElementsByTagNameNS(drawing, 'tr'));
  const serializer = new XMLSerializer();
  const oldStyle = serializer.serializeToString(
    rows().at(-1)!.getElementsByTagNameNS(drawing, 'tcPr')[0],
  );
  fillTable(
    element,
    Array.from({ length: 7 }, () => [1, 2, 3, 4, 5, 6]),
    {
      startRow: 1,
      resizeRows: true,
      resizeColumns: true,
    },
  );
  assert.deepEqual(ids('rowId').slice(0, rowIds.length), rowIds);
  assert.deepEqual(ids('colId').slice(0, colIds.length), colIds);
  assert.equal(ids('rowId').length, 8);
  assert.equal(ids('colId').length, 6);
  const all = [...ids('rowId'), ...ids('colId')];
  assert.equal(new Set(all).size, all.length);
  for (const id of all) assert.ok(Number(id) >= 0 && Number(id) <= 0xffffffff);
  for (const row of rows()) {
    const children = Array.from(row.childNodes).filter(
      (node) => node.nodeType === 1,
    );
    assert.equal(children.at(-1)!.localName, 'extLst');
  }
  assert.equal(
    serializer.serializeToString(
      rows().at(-1)!.getElementsByTagNameNS(drawing, 'tcPr')[0],
    ),
    oldStyle,
  );
  const extent = element
    .getElementsByTagNameNS(presentationNs, 'xfrm')[0]
    .getElementsByTagNameNS(drawing, 'ext')[0];
  assert.equal(
    Number(extent.getAttribute('cy')),
    rows().reduce((sum, row) => sum + Number(row.getAttribute('h')), 0),
  );
  assert.equal(
    Number(extent.getAttribute('cx')),
    Array.from(element.getElementsByTagNameNS(drawing, 'gridCol')).reduce(
      (sum, col) => sum + Number(col.getAttribute('w')),
      0,
    ),
  );
  assert.deepEqual(await readFile(path), before);
});
