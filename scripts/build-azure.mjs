import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import {
  chmod,
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

if (process.platform !== 'linux')
  throw new Error(
    'Build this Linux App Service package on Linux, WSL, or in the devcontainer.',
  );

const root = fileURLToPath(new URL('../', import.meta.url));
const distDir = join(root, 'dist');
if (!existsSync(distDir)) {
  throw new Error('dist/ directory not found. Run "npm run build" first.');
}

const output = join(root, 'output', 'azure', 'generator-api.zip');
const staging = await mkdtemp(join(tmpdir(), 'generator-api-azure-'));

try {
  // Compilation and checks run before packaging; CI supplies dist/ as an artifact.
  for (const name of [
    'dist',
    'package.json',
    'package-lock.json',
    'scripts/start-azure.sh',
    'templates',
  ]) {
    await mkdir(dirname(join(staging, name)), { recursive: true });
    await cp(join(root, name), join(staging, name), { recursive: true });
  }

  await chmod(join(staging, 'scripts', 'start-azure.sh'), 0o755);

  execFileSync('npm', ['ci', '--omit=dev', '--no-audit', '--no-fund'], {
    cwd: staging,
    stdio: 'inherit',
  });

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
