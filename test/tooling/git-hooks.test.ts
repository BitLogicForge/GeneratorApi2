import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, delimiter } from 'node:path';
import { fileURLToPath } from 'node:url';

const execute = promisify(execFile);
const root = fileURLToPath(new URL('../../', import.meta.url));

test('hook installer skips production and CI without requiring Husky', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'generator-hooks-install-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await writeFile(join(directory, '.git'), 'git metadata placeholder');
  const installer = join(directory, 'install-hooks.mjs');
  await writeFile(
    installer,
    await readFile(join(root, 'scripts/install-hooks.mjs')),
  );
  for (const settings of [
    { NODE_ENV: 'production' },
    { CI: 'true' },
    { HUSKY: '0' },
    { npm_config_omit: 'dev' },
  ]) {
    await execute(process.execPath, [installer], {
      cwd: directory,
      env: { ...process.env, ...settings },
    });
  }
});

test('staged formatting updates the index and preserves unstaged edits', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'generator-hooks-format-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const env = {
    ...process.env,
    HUSKY: '0',
    PATH: join(root, 'node_modules/.bin') + delimiter + process.env.PATH,
  };
  const git = (...args: string[]) =>
    execute('git', args, { cwd: directory, env });
  await git('init');
  await git('config', 'user.name', 'Hook test');
  await git('config', 'user.email', 'hook-test@example.com');
  const file = join(directory, 'sample.ts');
  await writeFile(file, 'const message = "before";\n');
  await git('add', 'sample.ts');
  await git(
    '-c',
    'core.hooksPath=/dev/null',
    'commit',
    '-m',
    'Initial test fixture',
  );
  await writeFile(file, "const message='staged';\n");
  await git('add', 'sample.ts');
  await writeFile(file, "const message='staged';\n// unstaged note\n");
  await execute(
    process.execPath,
    [
      join(root, 'node_modules/lint-staged/bin/lint-staged.js'),
      '--config',
      join(root, 'package.json'),
    ],
    { cwd: directory, env },
  );
  const staged = (await git('show', ':sample.ts')).stdout;
  const working = await readFile(file, 'utf8');
  assert.equal(staged, 'const message = "staged";\n');
  assert.equal(working, staged + '// unstaged note\n');
});
