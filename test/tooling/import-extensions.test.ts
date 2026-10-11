import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));

test('import check rejects JavaScript extensions in TypeScript source imports and re-exports', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'generator-import-check-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const file = join(directory, 'fixture.ts');
  const lint = () =>
    spawnSync(
      process.execPath,
      [
        join(root, 'node_modules/oxlint/bin/oxlint'),
        '--config',
        join(root, '.oxlint-imports.json'),
        '--deny-warnings',
        file,
      ],
      { cwd: directory, encoding: 'utf8' },
    );
  for (const source of [
    "import { value } from './module.js';\n",
    "import type { Value } from '../module.js';\n",
    "export { value } from './module.js';\n",
    "import { value } from '@/module.js';\n",
    "import { value } from '@/module.ts';\n",
  ]) {
    await writeFile(file, source);
    const result = lint();
    assert.equal(result.status, 1);
    assert.match(result.stdout + result.stderr, /no-restricted-imports/);
  }
  await writeFile(
    file,
    "import { value } from './module.ts';\nimport 'node:fs';\nimport './tool.mjs';\nimport { loadConfig } from '@/config';\nimport { fetchReportDataChain } from '@examples/data-api/chain/collect';\n",
  );
  const result = lint();
  assert.equal(result.status, 0, result.stdout + result.stderr);
});
