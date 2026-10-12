import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import JSZip from 'jszip';

import { AppError } from '@/errors';
import { TemplateState } from '@/observability/constants';
import { logTemplateValidationFailure } from '@/observability/template-validation';
import { findNamedObjects } from '@/pptx/jszip/objects';
import {
  packageNs,
  presentationNs,
  relationshipNs,
} from '@/pptx/jszip/package/namespaces';
import { createReportServices } from '@/reports/services';
import { TemplateSource } from '@/services/jszip/template-source';

function presentation(names: string[], shape = 'sp') {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', '<Types/>');
  zip.file(
    'ppt/presentation.xml',
    `<p:presentation xmlns:p="${presentationNs}" xmlns:r="${relationshipNs}"><p:sldIdLst><p:sldId id="256" r:id="rId1"/></p:sldIdLst></p:presentation>`,
  );
  zip.file(
    'ppt/_rels/presentation.xml.rels',
    `<Relationships xmlns="${packageNs}"><Relationship Id="rId1" Type="${relationshipNs}/slide" Target="slides/slide1.xml"/></Relationships>`,
  );
  zip.file(
    'ppt/slides/slide1.xml',
    `<p:sld xmlns:p="${presentationNs}"><p:cSld><p:spTree>${names.map((name, index) => `<p:${shape}><p:nvSpPr><p:cNvPr id="${index + 1}" name="${name}"/></p:nvSpPr></p:${shape}>`).join('')}</p:spTree></p:cSld></p:sld>`,
  );
  return zip;
}

test('missing-object errors list every missing name and the names available in the template', async () => {
  await assert.rejects(
    findNamedObjects(presentation(['X_T0', 'X_T1']), ['XT0', 'XT1']),
    (error: unknown) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.code, 'INVALID_TEMPLATE');
      assert.match(error.message, /Missing objects: XT0, XT1/);
      assert.match(error.message, /Available objects: X_T0, X_T1/);
      return true;
    },
  );
});

test('duplicate and unsupported-object errors identify the object and slide', async () => {
  await assert.rejects(
    findNamedObjects(presentation(['TEXT', 'TEXT']), ['TEXT']),
    /Duplicate object "TEXT" in ppt\/slides\/slide1.xml/,
  );
  await assert.rejects(
    findNamedObjects(presentation(['TEXT'], 'pic'), ['TEXT']),
    /Unsupported object "TEXT" in ppt\/slides\/slide1.xml: pic/,
  );
});

test('valid named objects remain usable', async () => {
  const { objects } = await findNamedObjects(presentation(['TEXT']), ['TEXT']);
  assert.equal(objects.get('TEXT')?.element.localName, 'sp');
});

test('template errors include the source file, retain their code, and preserve the original cause', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'template-validation-'));
  const path = join(folder, 'example.pptx');
  await writeFile(
    path,
    await presentation(['X_T0']).generateAsync({ type: 'nodebuffer' }),
  );
  const source = new TemplateSource(path, async (zip) => {
    await findNamedObjects(zip, ['XT0']);
  });
  await assert.rejects(source.load(), (error: unknown) => {
    assert.ok(error instanceof AppError);
    assert.equal(error.code, 'INVALID_TEMPLATE');
    assert.ok(error.message.includes(path));
    assert.match(error.message, /Missing objects: XT0/);
    assert.ok(error.cause instanceof AppError);
    return true;
  });
  const missing = new TemplateSource(
    join(folder, 'missing.pptx'),
    async () => {},
  );
  await assert.rejects(missing.load(), /Template ".*missing.pptx": ENOENT/);
});

test('startup logs all failed templates and readiness remains failed', async () => {
  const reports = createReportServices();
  const failures = [
    new AppError(
      500,
      'INVALID_TEMPLATE',
      'Template "first.pptx": Missing objects: XT0',
    ),
    new AppError(
      500,
      'INVALID_TEMPLATE',
      'Template "second.pptx": Duplicate object "TEXT"',
    ),
  ];
  for (const failure of failures) {
    reports.get({
      createService: () => ({
        generate: async () => Buffer.alloc(0),
        validate: async () => {
          throw failure;
        },
      }),
    });
  }
  const events: unknown[] = [];
  await assert.rejects(reports.initialize(), (error: unknown) => {
    assert.ok(error instanceof AggregateError);
    assert.deepEqual(error.errors, failures);
    logTemplateValidationFailure(error, {
      error: (event: unknown) => {
        events.push(event);
      },
    });
    return true;
  });
  assert.deepEqual(events, [
    { event: 'template_validation_failed', errors: failures },
  ]);
  assert.equal(reports.stats.state, TemplateState.Failed);
  await reports.close();
});

test('startup logging also preserves a single unexpected error', () => {
  const failure = new Error('Unexpected validation failure');
  const events: unknown[] = [];
  logTemplateValidationFailure(failure, {
    error: (event: unknown) => {
      events.push(event);
    },
  });
  assert.deepEqual(events, [
    { event: 'template_validation_failed', errors: [failure] },
  ]);
});
