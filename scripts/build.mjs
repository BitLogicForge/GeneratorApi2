import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import esbuild from 'esbuild';

const root = fileURLToPath(new URL('../', import.meta.url));
const srcDir = join(root, 'src');
const distDir = join(root, 'dist');
await rm(distDir, { recursive: true, force: true });

await esbuild.build({
  entryPoints: [join(srcDir, 'index.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  packages: 'external',
  outdir: distDir,
  outbase: srcDir,
  sourcemap: true,
  splitting: true,
});
