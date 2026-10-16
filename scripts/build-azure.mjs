import { execFileSync } from 'node:child_process';
import {
  cp,
  lstat,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  readlink,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import JSZip from 'jszip';

import { rewriteSourceAliases } from './rewrite-imports.mjs';

if (process.platform !== 'linux')
  throw new Error(
    'Build this Linux App Service package on Linux, WSL, or in the devcontainer.',
  );

const root = fileURLToPath(new URL('../', import.meta.url));
const output = join(root, 'output', 'azure', 'generator-api.zip');
const staging = await mkdtemp(join(tmpdir(), 'generator-api-azure-'));

function run(command, args, cwd = root) {
  execFileSync(command, args, { cwd, stdio: 'inherit' });
}

try {
  run('npm', ['run', 'typecheck']);
  // Compile into a fresh directory so renamed/deleted services cannot leave stale files.
  run(process.execPath, [
    'node_modules/typescript/bin/tsc',
    '-p',
    'tsconfig.json',
    '--outDir',
    join(staging, 'dist'),
    '--sourceMap',
    'false',
  ]);
  await rewriteSourceAliases(join(staging, 'dist'));
  for (const name of [
    'package.json',
    'package-lock.json',
    'scripts/start-azure.sh',
    'templates',
  ]) {
    await mkdir(dirname(join(staging, name)), { recursive: true });
    await cp(join(root, name), join(staging, name), { recursive: true });
  }
  run('npm', ['ci', '--omit=dev', '--no-audit', '--no-fund'], staging);

  const zip = new JSZip();
  // Dirents avoid traversing symlinked directories in node_modules.
  const entries = await readdir(staging, {
    recursive: true,
    withFileTypes: true,
  });
  const files = entries
    .filter((entry) => !entry.isDirectory())
    .map((entry) => join(entry.parentPath, entry.name))
    .sort();
  for (const path of files) {
    const info = await lstat(path);
    zip.file(
      relative(staging, path),
      info.isSymbolicLink() ? await readlink(path) : await readFile(path),
      { unixPermissions: info.mode, createFolders: false },
    );
  }
  await mkdir(dirname(output), { recursive: true });
  const archive = await zip.generateAsync({
    type: 'nodebuffer',
    platform: 'UNIX',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
  await writeFile(output, archive);
  console.log(
    `Azure package: ${output} (${(archive.length / 1024 / 1024).toFixed(1)} MB)`,
  );
  console.log('App Service startup command: bash scripts/start-azure.sh');
} finally {
  await rm(staging, { recursive: true, force: true });
}
