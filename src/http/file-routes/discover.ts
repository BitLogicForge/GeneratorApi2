import { readdir } from 'node:fs/promises';
import { extname, join, relative, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { compareRoutes } from './compare.ts';
import { routePath } from './path.ts';

import type { FileRoute, RouteFactory, RouteMethod } from './types.ts';

const methods = new Set([
  'get',
  'post',
  'put',
  'patch',
  'delete',
  'head',
  'options',
]);

/** Discovers and imports trusted route files once at startup, before accepting requests. */
export async function discoverRoutes(
  directory: URL,
  extension = extname(import.meta.url),
): Promise<FileRoute[]> {
  const root = fileURLToPath(directory);
  const files: Omit<FileRoute, 'factory'>[] = [];
  const seen = new Map<string, string>();
  async function visit(folder: string) {
    const entries = await readdir(folder, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      if (entry.name.startsWith('_') || entry.name.startsWith('.')) continue;
      const file = join(folder, entry.name);
      if (entry.isDirectory()) {
        await visit(file);
        continue;
      }
      if (!entry.isFile() || extname(entry.name) !== extension) continue;
      const method = entry.name.slice(0, -extension.length);
      if (!methods.has(method)) continue;
      const path = routePath(relative(root, file).split(sep).join('/'));
      // Express routes are case-insensitive and parameter names do not distinguish URLs.
      const key = `${method} ${path.replace(/:[A-Za-z_][A-Za-z0-9_]*/g, ':parameter').toLowerCase()}`;
      const duplicate = seen.get(key);
      if (duplicate)
        throw new Error(
          `Duplicate route ${method.toUpperCase()} ${path}: ${duplicate} and ${file}`,
        );
      seen.set(key, file);
      files.push({
        method: method as RouteMethod,
        path,
        file,
      });
    }
  }
  await visit(root);
  files.sort(compareRoutes);
  const routes: FileRoute[] = [];
  for (const file of files) {
    const module: { default?: unknown } = await import(
      pathToFileURL(file.file).href
    );
    if (typeof module.default !== 'function')
      throw new Error(
        `Route must default-export a handler factory: ${file.file}`,
      );
    routes.push({ ...file, factory: module.default as RouteFactory });
  }
  return routes;
}
