import { test } from 'node:test';
import assert from 'node:assert/strict';
import { XMLSerializer } from '@xmldom/xmldom';
import { findNamedObjects } from '@/pptx/jszip/objects';
import { fillTable } from '@/pptx/jszip/text-table';
import { drawing } from '@/pptx/jszip/package';
import { loadTemplate } from './fixtures.ts';

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
