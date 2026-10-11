import assert from 'node:assert/strict';
import { test } from 'node:test';

import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import JSZip from 'jszip';

import { drawing } from '@/pptx/jszip/package/namespaces';
import { writeXml } from '@/pptx/jszip/package/write-xml';
import { fillParagraphs } from '@/pptx/jszip/text/fill-paragraphs';
import { replaceParagraphText } from '@/pptx/jszip/text/replace-paragraph-text';

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

test('XML serialization refuses forbidden characters without writing a package part', () => {
  const document = new DOMParser().parseFromString(
    `<a:t xmlns:a="${drawing}">Safe</a:t>`,
    'application/xml',
  );
  document.documentElement!.textContent = 'A\u0001B';
  const zip = new JSZip();
  assert.throws(() => writeXml(zip, 'part.xml', document), {
    code: 'INVALID_TEMPLATE',
  });
  assert.equal(zip.file('part.xml'), null);
});
