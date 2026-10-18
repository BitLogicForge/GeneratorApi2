import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';

import { drawing } from '@/pptx/jszip/package/namespaces';
import { fillTable } from '@/pptx/jszip/tables/fill';

function fixture() {
  const cell = (text: string) =>
    `<a:tc><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr b="1" sz="1800"><a:solidFill><a:srgbClr val="123456"/></a:solidFill><a:latin typeface="Arial"/></a:rPr><a:t>${text}</a:t></a:r></a:p></a:txBody><a:tcPr><a:solidFill><a:srgbClr val="EEEEEE"/></a:solidFill></a:tcPr></a:tc>`;
  return new DOMParser().parseFromString(
    `<frame xmlns:a="${drawing}"><a:tbl><a:tblGrid><a:gridCol w="100"/><a:gridCol w="100"/><a:gridCol w="100"/></a:tblGrid><a:tr h="100">${cell('Header').repeat(3)}</a:tr><a:tr h="100">${cell('Value').repeat(3)}</a:tr></a:tbl></frame>`,
    'application/xml',
  ).documentElement!;
}

test('individual cell colors respect offsets and preserve header and styling in resized rows', () => {
  const element = fixture();
  const serializer = new XMLSerializer();
  const originalRows = element.getElementsByTagNameNS(drawing, 'tr');
  const header = serializer.serializeToString(originalRows[0]);
  const firstCell = serializer.serializeToString(
    originalRows[1].getElementsByTagNameNS(drawing, 'tc')[0],
  );
  fillTable(
    element,
    [
      ['A', 2],
      ['B', 3],
    ],
    {
      startRow: 1,
      startColumn: 1,
      resizeRows: true,
      cellColors: [
        [undefined, 'ff0000'],
        [undefined, '00ff00'],
      ],
    },
  );
  const rows = Array.from(element.getElementsByTagNameNS(drawing, 'tr'));
  assert.equal(rows.length, 3);
  assert.equal(serializer.serializeToString(rows[0]), header);
  for (const [index, row] of rows.slice(1).entries()) {
    const cells = row.getElementsByTagNameNS(drawing, 'tc');
    assert.equal(serializer.serializeToString(cells[0]), firstCell);
    assert.equal(
      cells[1]
        .getElementsByTagNameNS(drawing, 'rPr')[0]
        .getElementsByTagNameNS(drawing, 'srgbClr')[0]
        .getAttribute('val'),
      '123456',
    );
    const properties = cells[2].getElementsByTagNameNS(drawing, 'rPr')[0];
    assert.equal(properties.getAttribute('b'), '1');
    assert.equal(properties.getAttribute('sz'), '1800');
    assert.equal(
      properties.getElementsByTagNameNS(drawing, 'latin')[0].getAttribute('typeface'),
      'Arial',
    );
    assert.equal(
      properties.getElementsByTagNameNS(drawing, 'srgbClr')[0].getAttribute('val'),
      index === 0 ? 'FF0000' : '00FF00',
    );
    assert.equal(
      cells[2]
        .getElementsByTagNameNS(drawing, 'tcPr')[0]
        .getElementsByTagNameNS(drawing, 'srgbClr')[0]
        .getAttribute('val'),
      'EEEEEE',
    );
  }
});

test('cell colors create run properties for initially empty cells', () => {
  const element = fixture();
  const paragraph = element
    .getElementsByTagNameNS(drawing, 'tr')[1]
    .getElementsByTagNameNS(drawing, 'p')[0];
  paragraph.removeChild(paragraph.firstChild!);
  fillTable(element, [['New', 2, 3]], {
    startRow: 1,
    cellColors: [['0000FF', undefined, undefined]],
  });
  assert.equal(paragraph.getElementsByTagNameNS(drawing, 't')[0].textContent, 'New');
  assert.equal(
    paragraph
      .getElementsByTagNameNS(drawing, 'rPr')[0]
      .getElementsByTagNameNS(drawing, 'srgbClr')[0]
      .getAttribute('val'),
    '0000FF',
  );
});

test('invalid color values and matrix dimensions are rejected before changing the table', () => {
  for (const cellColors of [
    [['red', undefined, undefined]],
    [['#FF0000', undefined, undefined]],
    [['FFFFFF']],
    [],
    [
      ['FFFFFF', 'FFFFFF', 'FFFFFF'],
      ['FFFFFF', 'FFFFFF', 'FFFFFF'],
    ],
  ]) {
    const element = fixture();
    const serializer = new XMLSerializer();
    const before = serializer.serializeToString(element);
    assert.throws(
      () => fillTable(element, [[1, 2, 3]], { startRow: 1, cellColors }),
      /Table cell colors must/,
    );
    assert.equal(serializer.serializeToString(element), before);
  }
});
