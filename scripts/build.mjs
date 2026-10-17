import { readdir, rm } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import esbuild from 'esbuild';

const root = fileURLToPath(new URL('../', import.meta.url));
const srcDir = join(root, 'src');
const distDir = join(root, 'dist');
const routesDir = join(srcDir, 'routes');

const methods = new Set([
  'get',
  'post',
  'put',
  'patch',
  'delete',
  'head',
  'options',
]);

async function findRouteEntryPoints(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  entries.sort((a, b) => a.name.localeCompare(b.name));
  const files = [];
  for (const entry of entries) {
    if (entry.name.startsWith('_') || entry.name.startsWith('.')) continue;
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await findRouteEntryPoints(fullPath)));
    } else if (entry.isFile() && extname(entry.name) === '.ts') {
      const method = entry.name.slice(0, -3);
      if (methods.has(method)) {
        files.push(fullPath);
      }
    }
  }
  return files;
}

await rm(distDir, { recursive: true, force: true });

const routeFiles = await findRouteEntryPoints(routesDir);

await esbuild.build({
  entryPoints: [join(srcDir, 'index.ts'), ...routeFiles],
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
