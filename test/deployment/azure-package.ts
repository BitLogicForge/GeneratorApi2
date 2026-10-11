import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';

import express from 'express';
import JSZip from 'jszip';

import type { AddressInfo } from 'node:net';

test('Azure ZIP includes production assets and runs real document downloads', async (t) => {
  const archive = await JSZip.loadAsync(
    await readFile(
      new URL('../../output/azure/generator-api.zip', import.meta.url),
    ),
  );
  for (const name of [
    'dist/index.js',
    'node_modules/express/package.json',
    'node_modules/playwright/cli.js',
    'templates/business.pptx',
    'templates/daa.pptx',
    'scripts/start-azure.sh',
    'scripts/install-hooks.mjs',
  ])
    assert.ok(archive.file(name), `Missing ${name}`);
  assert.equal(archive.file('node_modules/typescript/package.json'), null);
  assert.equal(archive.file('node_modules/tsx/package.json'), null);
  assert.equal(archive.file('dist/services/daa-presentation.js'), null);
  for (const name of Object.keys(archive.files))
    assert.ok(
      !/^(src\/|test\/|examples\/|output\/|\.env)/.test(name),
      `Unexpected ${name}`,
    );

  const directory = await mkdtemp(join(tmpdir(), 'generator-api-azure-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const links: { path: string; target: string }[] = [];
  for (const [name, file] of Object.entries(archive.files)) {
    if (file.dir) continue;
    const path = join(directory, name);
    await mkdir(dirname(path), { recursive: true });
    const permissions = Number(file.unixPermissions ?? 0o100644);
    if ((permissions & 0o170000) === 0o120000)
      links.push({ path, target: await file.async('string') });
    else {
      await writeFile(path, await file.async('nodebuffer'));
      await chmod(path, permissions & 0o777);
    }
  }
  for (const link of links) await symlink(link.target, link.path);

  const webapp = express();
  let language: unknown;
  webapp.get('/documents/:id', (req, res) => {
    language = req.query.language;
    res.send('<html><body><h1>Azure package PDF smoke test</h1></body></html>');
  });
  const upstream = webapp.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => upstream.once('listening', resolve));
  t.after(
    () => new Promise<void>((resolve) => upstream.close(() => resolve())),
  );
  const reservation = createServer();
  await new Promise<void>((resolve) =>
    reservation.listen(0, '127.0.0.1', resolve),
  );
  const port = (reservation.address() as AddressInfo).port;
  await new Promise<void>((resolve) => reservation.close(() => resolve()));
  const server = spawn(process.execPath, ['dist/index.js'], {
    cwd: directory,
    env: {
      ...process.env,
      NODE_ENV: 'production',
      HOST: '127.0.0.1',
      PORT: String(port),
      WEBAPP_BASE_URL: `http://127.0.0.1:${(upstream.address() as AddressInfo).port}`,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let errors = '';
  server.stderr.on('data', (chunk) => {
    errors += chunk.toString();
  });
  t.after(async () => {
    if (server.exitCode !== null || server.signalCode !== null) return;
    await new Promise<void>((resolve) => {
      server.once('exit', () => resolve());
      server.kill('SIGTERM');
    });
  });
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('Packaged server startup timed out')),
      10000,
    );
    server.stdout.once('data', () => {
      clearTimeout(timer);
      resolve();
    });
    server.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    server.once('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`Packaged server exited ${code}: ${errors}`));
    });
  });
  const baseUrl = `http://127.0.0.1:${port}`;
  const health = await fetch(`${baseUrl}/health`);
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { status: 'ok' });
  const pptx = await fetch(
    `${baseUrl}/api/exports/pptx/jszip/daa?TEXT_ME=Azure%20smoke%20test`,
  );
  assert.equal(pptx.status, 200);
  const deck = await JSZip.loadAsync(await pptx.arrayBuffer());
  assert.match(
    await deck.file('ppt/slides/slide1.xml')!.async('string'),
    /Azure smoke test/,
  );
  const pdf = await fetch(`${baseUrl}/api/exports/pdf/portrait/id2222.pdf`);
  assert.equal(pdf.status, 200, pdf.ok ? '' : await pdf.text());
  assert.equal(
    Buffer.from(await pdf.arrayBuffer())
      .subarray(0, 5)
      .toString(),
    '%PDF-',
  );
  assert.equal(language, 'en');
});
