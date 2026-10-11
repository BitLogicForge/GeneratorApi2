import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';

import JSZip from 'jszip';
import request from 'supertest';

import { createApp } from '@/app';
import { PowerPointTemplateService } from '@/services/jszip/power-point-template-service';
import { loadTemplateCatalog } from '@/templates/catalog';

const templates = new URL('../../templates/', import.meta.url);

test('catalog describes registered templates and preflight leaves source presentations unchanged', async () => {
  const names = ['summary.pptx', 'business.pptx', 'daa.pptx'];
  const before = await Promise.all(
    names.map((name) => readFile(new URL(name, templates))),
  );
  const catalog = await loadTemplateCatalog(templates);
  assert.deepEqual(
    await Promise.all(names.map((name) => readFile(new URL(name, templates)))),
    before,
  );
  const app = createApp({
    pdf: { generate: async () => Buffer.alloc(0) },
    presentations: { generate: async () => Buffer.alloc(0) },
    templateCatalog: catalog.map((entry) => entry.metadata),
  });
  const response = await request(app).get('/api/templates').expect(200);
  assert.ok(response.headers['x-request-id']);
  assert.deepEqual(
    response.body.templates.map((entry: { id: string }) => entry.id),
    ['summary', 'business', 'daa'],
  );
  const summary = response.body.templates[0];
  assert.deepEqual(summary.placeholders, ['customer', 'subtitle', 'title']);
  assert.deepEqual(summary.requestSchema.required, ['replacements']);
  assert.deepEqual(
    summary.requestSchema.properties.replacements.required,
    summary.placeholders,
  );
  assert.equal(
    summary.requestSchema.properties.replacements.additionalProperties,
    false,
  );
  const demo = response.body.templates[2];
  assert.deepEqual(demo.requestSchema.required, undefined);
  assert.deepEqual(
    demo.objects.map((object: { name: string }) => object.name),
    ['TAB100', 'GGO', 'TEXT_ME'],
  );
  assert.deepEqual(demo.charts[0].types, ['lineChart']);
  const json = JSON.stringify(response.body);
  assert.ok(!json.includes('"path"'));
  assert.ok(!json.includes('"file"'));
  assert.ok(!json.includes('/workspaces/'));
  await request(app).head('/api/templates').expect(200);
});

test('registering a text template enables discovery and GET/POST/HEAD exports without another route file', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'generator-catalog-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await writeFile(
    join(directory, 'custom.pptx'),
    await readFile(new URL('summary.pptx', templates)),
  );
  await writeFile(
    join(directory, 'catalog.json'),
    JSON.stringify([
      {
        id: 'custom',
        version: '2.0.0',
        description: 'Custom report',
        file: 'custom.pptx',
        mode: 'placeholders',
        requiredPlaceholders: ['title'],
      },
    ]),
  );
  const catalog = await loadTemplateCatalog(pathToFileURL(directory + '/'));
  const app = createApp({
    pdf: { generate: async () => Buffer.alloc(0) },
    presentations: { generate: async () => Buffer.alloc(0) },
    templateCatalog: catalog.map((entry) => entry.metadata),
    templatePresentations: new PowerPointTemplateService({
      custom: catalog[0].path,
    }),
  });
  const input = {
    filename: 'custom-report',
    replacements: {
      title: 'Discovered title',
      subtitle: 'Subtitle',
      customer: 'Customer',
    },
  };
  for (const method of ['get', 'post'] as const) {
    const pending = request(app)[method]('/api/exports/pptx/jszip/custom');
    const response = await (
      method === 'get'
        ? pending.query({
            filename: input.filename,
            replacements: JSON.stringify(input.replacements),
          })
        : pending.send(input)
    )
      .buffer(true)
      .parse((res, done) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => done(null, Buffer.concat(chunks)));
      })
      .expect(200);
    assert.match(response.headers['content-disposition'], /custom-report.pptx/);
    const zip = await JSZip.loadAsync(response.body);
    assert.match(
      await zip.file('ppt/slides/slide1.xml')!.async('string'),
      /Discovered title/,
    );
  }
  await request(app)
    .head('/api/exports/pptx/jszip/custom')
    .query({
      filename: input.filename,
      replacements: JSON.stringify(input.replacements),
    })
    .expect(200);
  await request(app)
    .post('/api/exports/pptx/jszip/custom')
    .send({ replacements: { title: 'Incomplete' } })
    .expect(400);
  await request(app)
    .post('/api/exports/pptx/jszip/custom')
    .send({ ...input, replacements: { ...input.replacements, typo: 'Extra' } })
    .expect(400);
  await request(app)
    .post('/api/exports/pptx/jszip/unknown')
    .send(input)
    .expect(404);
  await request(app)
    .head('/api/exports/pptx/jszip/summary')
    .query({ replacements: JSON.stringify(input.replacements) })
    .expect(404);
});

test('preflight rejects missing placeholders, broken relationships, malformed XML, and duplicate IDs', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'generator-preflight-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const definition = {
    id: 'custom',
    version: '1',
    description: 'Test',
    file: 'custom.pptx',
    mode: 'placeholders',
    requiredPlaceholders: ['missing'],
  };
  const source = await readFile(new URL('summary.pptx', templates));
  await writeFile(
    join(directory, 'catalog.json'),
    JSON.stringify([definition]),
  );
  await writeFile(join(directory, 'custom.pptx'), source);
  const url = pathToFileURL(directory + '/');
  await assert.rejects(loadTemplateCatalog(url), /missing placeholder missing/);
  definition.requiredPlaceholders = ['title'];
  await writeFile(
    join(directory, 'catalog.json'),
    JSON.stringify([definition]),
  );
  const broken = await JSZip.loadAsync(source);
  broken.remove('ppt/theme/theme1.xml');
  await writeFile(
    join(directory, 'custom.pptx'),
    await broken.generateAsync({ type: 'nodebuffer' }),
  );
  await assert.rejects(loadTemplateCatalog(url), /broken relationship/);
  const malformed = await JSZip.loadAsync(source);
  malformed.file('ppt/slides/slide1.xml', '<p:sld>');
  await writeFile(
    join(directory, 'custom.pptx'),
    await malformed.generateAsync({ type: 'nodebuffer' }),
  );
  await assert.rejects(loadTemplateCatalog(url), /invalid XML/);
  await writeFile(join(directory, 'custom.pptx'), source);
  await writeFile(
    join(directory, 'catalog.json'),
    JSON.stringify([definition, definition]),
  );
  await assert.rejects(loadTemplateCatalog(url), /Duplicate template ID/);
});

test('preflight rejects missing/duplicate named objects, wrong tables, and unsupported editable charts', async (t) => {
  const directory = await mkdtemp(
    join(tmpdir(), 'generator-preflight-objects-'),
  );
  t.after(() => rm(directory, { recursive: true, force: true }));
  const manifest = JSON.parse(
    await readFile(new URL('catalog.json', templates), 'utf8'),
  );
  await writeFile(
    join(directory, 'catalog.json'),
    JSON.stringify([manifest[2]]),
  );
  const source = await readFile(new URL('daa.pptx', templates));
  for (const change of ['missing', 'duplicate', 'table', 'chart']) {
    const zip = await JSZip.loadAsync(source);
    const part =
      change === 'chart' ? 'ppt/charts/chart1.xml' : 'ppt/slides/slide1.xml';
    let xml = await zip.file(part)!.async('string');
    if (change === 'missing')
      xml = xml.replace('name="TEXT_ME"', 'name="OTHER"');
    if (change === 'duplicate')
      xml = xml.replace('name="TEXT_ME"', 'name="TAB100"');
    if (change === 'table') {
      const altered = structuredClone(manifest[2]);
      altered.requiredObjects[0].rows = 5;
      await writeFile(
        join(directory, 'catalog.json'),
        JSON.stringify([altered]),
      );
    } else
      await writeFile(
        join(directory, 'catalog.json'),
        JSON.stringify([manifest[2]]),
      );
    if (change === 'chart') xml = xml.replaceAll('lineChart', 'scatterChart');
    zip.file(part, xml);
    await writeFile(
      join(directory, 'daa.pptx'),
      await zip.generateAsync({ type: 'nodebuffer' }),
    );
    await assert.rejects(loadTemplateCatalog(pathToFileURL(directory + '/')));
  }
});

test('text templates report duplicate names and unsupported preserved charts as warnings', async (t) => {
  const directory = await mkdtemp(
    join(tmpdir(), 'generator-preflight-warnings-'),
  );
  t.after(() => rm(directory, { recursive: true, force: true }));
  const zip = await JSZip.loadAsync(
    await readFile(new URL('daa.pptx', templates)),
  );
  zip.file(
    'ppt/slides/slide1.xml',
    (await zip.file('ppt/slides/slide1.xml')!.async('string'))
      .replace('<a:t>', '<a:t>{{title}} ')
      .replace('name="TEXT_ME"', 'name="TAB100"'),
  );
  zip.file(
    'ppt/charts/chart1.xml',
    (await zip.file('ppt/charts/chart1.xml')!.async('string')).replaceAll(
      'lineChart',
      'scatterChart',
    ),
  );
  const source = await zip.generateAsync({ type: 'nodebuffer' });
  await writeFile(join(directory, 'custom.pptx'), source);
  await writeFile(
    join(directory, 'catalog.json'),
    JSON.stringify([
      {
        id: 'custom',
        version: '1',
        description: 'Preserved chart',
        file: 'custom.pptx',
        mode: 'placeholders',
        requiredPlaceholders: ['title'],
      },
    ]),
  );
  const [entry] = await loadTemplateCatalog(pathToFileURL(directory + '/'));
  assert.deepEqual(entry.metadata.placeholders, ['title']);
  assert.ok(entry.metadata.warnings.includes('Duplicate object name: TAB100'));
  assert.ok(
    entry.metadata.warnings.some((warning) => warning.includes('unsupported')),
  );
  assert.deepEqual(entry.metadata.charts[0].types, ['scatterChart']);
  assert.deepEqual(await readFile(join(directory, 'custom.pptx')), source);
});
