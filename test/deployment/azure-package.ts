import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import JSZip from 'jszip';

test('Azure ZIP package contains production assets and excludes development files', async () => {
  const zipPath = new URL(
    '../../output/azure/generator-api.zip',
    import.meta.url,
  );
  const buffer = await readFile(zipPath);
  const archive = await JSZip.loadAsync(buffer);

  for (const name of [
    'dist/index.js',
    'node_modules/express/package.json',
    'node_modules/playwright/cli.js',
    'templates/daa.pptx',
    'templates/Tmp1.pptx',
    'templates/Tmp2.pptx',
    'scripts/start-azure.sh',
    'package.json',
  ]) {
    assert.ok(archive.file(name), `Missing ${name} in Azure package`);
  }

  assert.equal(archive.file('node_modules/typescript/package.json'), null);
  assert.equal(archive.file('node_modules/tsx/package.json'), null);
  assert.equal(archive.file('node_modules/oxlint/package.json'), null);

  for (const name of Object.keys(archive.files)) {
    assert.ok(
      !/^(src\/|test\/|examples\/|output\/|\.env)/.test(name),
      `Unexpected development file in package: ${name}`,
    );
  }

  const startScript = archive.file('scripts/start-azure.sh');
  assert.ok(startScript, 'Missing start-azure.sh');
  const mode = Number(startScript.unixPermissions ?? 0);
  assert.ok((mode & 0o111) !== 0, 'start-azure.sh must be executable');
});
