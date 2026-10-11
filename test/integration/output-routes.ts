import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import express from 'express';
import JSZip from 'jszip';

import { createApp } from '@/app';
import { DaaPocPresentationService } from '@/services/jszip/daa-poc-presentation-service';
import { PowerPointTemplateService } from '@/services/jszip/power-point-template-service';
import { WebPagePdfService } from '@/services/pdf/web-page-pdf';
import { PowerPointGenerationService } from '@/services/pptxgenjs/power-point-generation-service';

import type { AddressInfo } from 'node:net';

const outputDir = new URL('../../output/routes/', import.meta.url);

test('download real documents from HTTP routes and save output files', async (t) => {
  await mkdir(outputDir, { recursive: true });
  const webapp = express();
  const languages: string[] = [];
  let documentQuery: Record<string, unknown> = {};
  webapp.get('/documents/:id', (req, res) => {
    documentQuery = { ...req.query };
    const language = req.query.language === 'de' ? 'de' : 'en';
    languages.push(language);
    res.send(
      `<html><body><h1 data-ready>${language === 'de' ? 'Dokument' : 'Document'} id2222</h1><p>Language: ${language}</p></body></html>`,
    );
  });
  let quarterlyRequest:
    { method: string; query: Record<string, unknown> } | undefined;
  webapp.get('/reports/quarterly', (req, res) => {
    quarterlyRequest = { method: req.method, query: { ...req.query } };
    res.send(
      '<html><body><h1 data-report-ready>Quarterly report</h1><p>Projects delivered: 12</p></body></html>',
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
    templateReportDemo: new DaaPocPresentationService(
      fileURLToPath(new URL('../../templates/daa.pptx', import.meta.url)),
    ),
    pdf,
    presentations: new PowerPointGenerationService(),
    templatePresentations: new PowerPointTemplateService({
      business: fileURLToPath(
        new URL('../../templates/business.pptx', import.meta.url),
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
    payload?: Record<string, unknown>,
  ) => {
    const response = await fetch(
      `${baseUrl}${route}`,
      payload
        ? {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          }
        : undefined,
    );
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
      if (
        route.startsWith('/api/exports/pdf/portrait/') ||
        route.startsWith('/api/exports/pdf/landscape/') ||
        payload
      ) {
        const box = bytes
          .toString('latin1')
          .match(/\/MediaBox\s*\[0 0 ([\d.]+) ([\d.]+)\]/);
        assert.ok(box);
        assert.equal(
          Number(box[1]) > Number(box[2]),
          payload
            ? payload.landscape === true
            : route.startsWith('/api/exports/pdf/landscape/'),
        );
      }
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
      await save(
        '/api/exports/pdf/portrait/id2222.pdf',
        'document-portrait.pdf',
      );
      assert.equal(languages.at(-1), 'en');
    });
    await t.test('simple PDF URL with language override', async () => {
      await save(
        '/api/exports/pdf/portrait/id2222.pdf?language=de&year=2027',
        'document-portrait-de.pdf',
      );
      assert.equal(languages.at(-1), 'de');
      assert.deepEqual(documentQuery, { language: 'de', year: '2027' });
    });
    await t.test('document PDF with fixed landscape orientation', async () => {
      await save(
        '/api/exports/pdf/landscape/id2222.pdf?language=pl&year=2028',
        'document-landscape.pdf',
      );
      assert.deepEqual(documentQuery, { language: 'pl', year: '2028' });
    });
    await t.test('PDF API with readiness and print options', async () => {
      const params = new URLSearchParams({
        route: '/documents/id2222',
        filename: 'custom-report',
        waitForSelector: '[data-ready]',
        format: 'Letter',
        landscape: 'true',
      });
      await save(`/api/exports/pdf/test?${params}`, 'custom-report.pdf');
    });
    await t.test(
      'fixed portrait report forwards GET parameters to the webapp',
      async () => {
        await save(
          '/api/exports/pdf/portrait/quarterly?year=2027&quarter=2&language=pl',
          'quarterly-2027-q2-pl.pdf',
        );
        assert.deepEqual(quarterlyRequest, {
          method: 'GET',
          query: { year: '2027', quarter: '2', language: 'pl' },
        });
      },
    );
    for (const orientation of ['portrait', 'landscape']) {
      await t.test(
        `quarterly ${orientation} POST request example`,
        async () => {
          const payload = JSON.parse(
            await readFile(
              new URL(
                `../../examples/pdf/quarterly-${orientation}.json`,
                import.meta.url,
              ),
              'utf8',
            ),
          );
          await save(
            '/api/exports/pdf/test',
            `${payload.filename}.pdf`,
            undefined,
            payload,
          );
        },
      );
    }
    await t.test('generated editable PowerPoint', async () => {
      const payload = JSON.parse(
        await readFile(
          new URL('../../examples/pptx/generated.json', import.meta.url),
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
        `/api/exports/pptx/pptxgenjs/brief?${params}`,
        'quarterly-review.pptx',
        'A clearer path forward',
      );
    });
    await t.test('edited business PowerPoint template', async () => {
      const payload = JSON.parse(
        await readFile(
          new URL('../../examples/pptx/template.json', import.meta.url),
          'utf8',
        ),
      );
      const params = new URLSearchParams({
        filename: payload.filename,
        replacements: JSON.stringify(payload.replacements),
      });
      await save(
        `/api/exports/pptx/jszip/business?${params}`,
        'customer-proposal.pptx',
        'Acme Corporation',
      );
    });
    await t.test(
      'Template report demo with random table and chart data',
      async () => {
        await save(
          '/api/exports/pptx/jszip/daa?TEXT_ME=Example%20report',
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
