import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execute = promisify(execFile);
const script = fileURLToPath(
  new URL('../../scripts/verify-ci.sh', import.meta.url),
);

test('CI verification propagates lint, browser installation, and test failures', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'generator-ci-verification-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const npm = join(directory, 'npm');
  await writeFile(
    npm,
    `#!/usr/bin/env node
const { appendFileSync } = require('node:fs');
const command = process.argv.slice(2).join(' ');
appendFileSync(process.env.CI_VERIFY_LOG, command + '\\n');
if (command === process.env.CI_VERIFY_FAIL) process.exit(27);
`,
  );
  await chmod(npm, 0o755);
  const commands = ['run lint', 'run browser:install', 'test'];
  for (const failure of [...commands, '']) {
    const log = join(directory, 'calls.log');
    await writeFile(log, '');
    const run = execute('bash', [script], {
      env: {
        ...process.env,
        PATH: directory + delimiter + process.env.PATH,
        CI_VERIFY_LOG: log,
        CI_VERIFY_FAIL: failure,
      },
    });
    if (failure) await assert.rejects(run, { code: 27 });
    else await run;
    const calls = (await readFile(log, 'utf8')).trim().split('\n');
    assert.deepEqual(
      calls,
      failure ? commands.slice(0, commands.indexOf(failure) + 1) : commands,
    );
  }
});
