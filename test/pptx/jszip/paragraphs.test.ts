import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import { fillParagraphs, replaceParagraphText } from '@/pptx/jszip/paragraphs';
import { drawing } from '@/pptx/jszip/package';

test('paragraph edits preserve run properties, escape text, and do not cross paragraphs', () => {
  const document = new DOMParser().parseFromString(
    `<p:sp xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="${drawing}"><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:pPr lvl="1"/><a:r><a:rPr b="1"/><a:t>Hello {{cus</a:t></a:r><a:r><a:rPr i="1"/><a:t>tomer}}!</a:t></a:r></a:p><a:p><a:r><a:t>Another paragraph</a:t></a:r></a:p></p:txBody></p:sp>`,
    'application/xml',
  );
  const element = document.documentElement!;
  assert.equal(replaceParagraphText(element, '{{customer}}', 'A & B'), 1);
  assert.equal(replaceParagraphText(element, '!Another', 'no'), 0);
  assert.equal(
    element.getElementsByTagNameNS(drawing, 'rPr')[0].getAttribute('b'),
    '1',
  );
  assert.match(new XMLSerializer().serializeToString(document), /A &amp; B/);
  fillParagraphs(element, ['One', 'Two', 'Three']);
  assert.deepEqual(
    Array.from(element.getElementsByTagNameNS(drawing, 't')).map(
      (node) => node.textContent,
    ),
    ['One', 'Two', 'Three'],
  );
  fillParagraphs(element, ['Only']);
  assert.equal(element.getElementsByTagNameNS(drawing, 'p').length, 1);
  assert.equal(
    element.getElementsByTagNameNS(drawing, 'pPr')[0].getAttribute('lvl'),
    '1',
  );
});
