import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const execute = promisify(execFile);
const rewriter = fileURLToPath(
  new URL('../../scripts/rewrite-imports.mjs', import.meta.url),
);

test('built aliases support imports, re-exports, and dynamic imports in plain Node', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'generator-aliases-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await mkdir(join(directory, 'nested'));
  await mkdir(join(directory, 'folder'));
  await writeFile(join(directory, 'package.json'), '{"type":"module"}');
  await writeFile(join(directory, 'value.js'), 'export const value = 42;');
  await writeFile(
    join(directory, 'folder/index.js'),
    'export const label = "folder";',
  );
  const entry = join(directory, 'nested/entry.js');
  await writeFile(
    entry,
    `
import { value } from '@/value';
export { value } from '@/value';
import { label } from '@/folder';
const unchanged = "@/value";
const dynamic = await import('@/value');
console.log(JSON.stringify({ value, dynamic: dynamic.value, unchanged, label }));
`,
  );
  await execute(process.execPath, [rewriter, directory]);
  const output = (await execute(process.execPath, [entry])).stdout;
  assert.deepEqual(JSON.parse(output), {
    value: 42,
    dynamic: 42,
    unchanged: '@/value',
    label: 'folder',
  });
  const source = await readFile(entry, 'utf8');
  assert.match(source, /\.\.\/value\.js/);
  assert.match(source, /\.\.\/folder\/index\.js/);
  await execute(process.execPath, [rewriter, directory]);
  assert.equal(await readFile(entry, 'utf8'), source);
  await writeFile(entry, "import { value } from '@/missing';");
  await assert.rejects(execute(process.execPath, [rewriter, directory]), {
    code: 1,
  });
});
