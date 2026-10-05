import { spawn } from 'node:child_process';
import {
  cp,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  readlink,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import JSZip from 'jszip';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = join(root, 'output', 'azure', 'generator-api.zip');
const staging = await mkdtemp(join(tmpdir(), 'generator-api-azure-'));
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

async function run(command, args, cwd = root) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: 'inherit',
      env: process.env,
    });
    child.once('error', reject);
    child.once('exit', (code, signal) =>
      code === 0
        ? resolve()
        : reject(new Error(`${command} failed (${signal ?? code})`)),
    );
  });
}

try {
  // Compile into a fresh directory so renamed/deleted services cannot leave stale files.
  await run(process.execPath, [
    'node_modules/typescript/bin/tsc',
    '-p',
    'tsconfig.json',
    '--outDir',
    join(staging, 'dist'),
    '--sourceMap',
    'false',
  ]);
  for (const name of ['package.json', 'package-lock.json'])
    await cp(join(root, name), join(staging, name));
  await mkdir(join(staging, 'templates'));
  for (const file of await readdir(join(root, 'templates'))) {
    if (file.endsWith('.pptx'))
      await cp(join(root, 'templates', file), join(staging, 'templates', file));
  }
  await mkdir(join(staging, 'scripts'));
  await cp(
    join(root, 'scripts', 'start-azure.sh'),
    join(staging, 'scripts', 'start-azure.sh'),
  );
  await run(npm, ['ci', '--omit=dev', '--no-audit', '--no-fund'], staging);

  const zip = new JSZip();
  async function addDirectory(directory) {
    for (const name of (await readdir(directory)).sort()) {
      const path = join(directory, name);
      const info = await lstat(path);
      const archivePath = relative(staging, path).split('\\').join('/');
      if (info.isDirectory()) await addDirectory(path);
      else
        zip.file(
          archivePath,
          info.isSymbolicLink() ? await readlink(path) : await readFile(path),
          {
            unixPermissions: info.mode,
            createFolders: false,
          },
        );
    }
  }
  await addDirectory(staging);
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
