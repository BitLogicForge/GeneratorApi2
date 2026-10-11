import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type { AddressInfo } from 'node:net';
import express from 'express';
import JSZip from 'jszip';
import { createApp } from '../src/app.js';
import { TemplateReportDemoService } from '../src/pptx/jszip/template-report-demo.js';
import { WebPagePdfService } from '../src/services/web-page-pdf.js';
import { GeneratedPresentationService } from '../src/pptx/pptxgenjs/generated-presentation.js';
import { PowerPointTemplateService } from '../src/pptx/jszip/powerpoint-template.js';

const outputDir = new URL('../output/routes/', import.meta.url);

test('download real documents from HTTP routes and save output files', async (t) => {
  await mkdir(outputDir, { recursive: true });
  const webapp = express();
  const languages: string[] = [];
  webapp.get('/documents/:id', (req, res) => {
    const language = req.query.language === 'de' ? 'de' : 'en';
    languages.push(language);
    res.send(
      `<html><body><h1 data-ready>${language === 'de' ? 'Dokument' : 'Document'} id2222</h1><p>Language: ${language}</p></body></html>`,
    );
  });
  const upstream = webapp.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => upstream.once('listening', resolve));
  const pdf = new WebPagePdfService({
    baseUrl: `http://127.0.0.1:${(upstream.address() as AddressInfo).port}`,
    port: 3000,
    concurrency: 2,
    timeout: 10000,
  });
  const app = createApp({
    templateReportDemo: new TemplateReportDemoService(
      fileURLToPath(new URL('../templates/daa.pptx', import.meta.url)),
    ),
    pdf,
    presentations: new GeneratedPresentationService(),
    templatePresentations: new PowerPointTemplateService({
      business: fileURLToPath(
        new URL('../templates/business.pptx', import.meta.url),
      ),
    }),
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const manifest: { route: string; file: string; bytes: number }[] = [];
  const save = async (
    route: string,
    filename: string,
    expectedText?: string,
  ) => {
    const response = await fetch(`${baseUrl}${route}`);
    assert.equal(
      response.status,
      200,
      await (response.ok ? Promise.resolve('') : response.text()),
    );
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.match(
      response.headers.get('content-disposition') ?? '',
      /attachment/,
    );
    const bytes = Buffer.from(await response.arrayBuffer());
    if (filename.endsWith('.pdf')) {
      assert.match(
        response.headers.get('content-type') ?? '',
        /application\/pdf/,
      );
      assert.equal(bytes.subarray(0, 5).toString(), '%PDF-');
      assert.match(bytes.subarray(-1024).toString(), /%%EOF/);
    } else {
      assert.match(
        response.headers.get('content-type') ?? '',
        /presentationml/,
      );
      const zip = await JSZip.loadAsync(bytes);
      assert.ok(zip.file('ppt/presentation.xml'));
      const slides = await Promise.all(
        Object.keys(zip.files)
          .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
          .map((name) => zip.file(name)!.async('string')),
      );
      if (expectedText) assert.ok(slides.join('').includes(expectedText));
      assert.doesNotMatch(slides.join(''), /\{\{/);
    }
    await writeFile(new URL(filename, outputDir), bytes);
    manifest.push({
      route,
      file: `output/routes/${filename}`,
      bytes: bytes.length,
    });
  };
  try {
    await t.test('simple PDF URL with default language', async () => {
      await save('/id2222.pdf', 'id2222.pdf');
      assert.equal(languages.at(-1), 'en');
    });
    await t.test('simple PDF URL with language override', async () => {
      await save('/id2222.pdf?language=de', 'id2222-de.pdf');
      assert.equal(languages.at(-1), 'de');
    });
    await t.test('PDF API with readiness and print options', async () => {
      const params = new URLSearchParams({
        route: '/documents/id2222',
        filename: 'custom-report',
        waitForSelector: '[data-ready]',
        format: 'Letter',
        landscape: 'true',
      });
      await save(`/api/exports/pdf?${params}`, 'custom-report.pdf');
    });
    await t.test('generated editable PowerPoint', async () => {
      const payload = JSON.parse(
        await readFile(
          new URL('../examples/presentation.json', import.meta.url),
          'utf8',
        ),
      );
      const params = new URLSearchParams(
        Object.entries(payload).map(([key, value]) => [
          key,
          typeof value === 'string' ? value : JSON.stringify(value),
        ]),
      );
      await save(
        `/api/exports/pptx/generated/brief?${params}`,
        'quarterly-review.pptx',
        'A clearer path forward',
      );
    });
    await t.test('edited business PowerPoint template', async () => {
      const payload = JSON.parse(
        await readFile(
          new URL('../examples/template-presentation.json', import.meta.url),
          'utf8',
        ),
      );
      const params = new URLSearchParams({
        filename: payload.filename,
        replacements: JSON.stringify(payload.replacements),
      });
      await save(
        `/api/exports/pptx/templates/business?${params}`,
        'customer-proposal.pptx',
        'Acme Corporation',
      );
    });
    await t.test(
      'Template report demo with random table and chart data',
      async () => {
        await save(
          '/demo-report.pptx?TEXT_ME=Example%20report',
          'demo-report.pptx',
          'Example report',
        );
      },
    );
    await writeFile(
      new URL('manifest.json', outputDir),
      JSON.stringify(manifest, null, 2) + '\n',
    );
    console.log(`Output files: ${fileURLToPath(outputDir)}`);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    await pdf.close();
    await new Promise<void>((resolve, reject) =>
      upstream.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
