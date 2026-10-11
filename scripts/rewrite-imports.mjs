import { access, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { init, parse } from 'es-module-lexer/minimal';

/** Rewrites source aliases in emitted JavaScript so Node needs no runtime loader. */
export async function rewriteSourceAliases(outputDirectory) {
  const root = resolve(outputDirectory);
  await init();
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const file = join(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(file);
        continue;
      }
      if (!entry.name.endsWith('.js')) continue;
      let source = await readFile(file, 'utf8');
      const [imports] = parse(source);
      let changed = false;
      for (const item of imports.reverse()) {
        if (!item.n?.startsWith('@/')) continue;
        const target = join(root, item.n.slice(2));
        let resolved = `${target}.js`;
        try {
          await access(resolved);
        } catch {
          resolved = join(target, 'index.js');
          await access(resolved);
        }
        let specifier = relative(dirname(file), resolved).split('\\').join('/');
        if (!specifier.startsWith('.')) specifier = `./${specifier}`;
        const replacement = item.d >= 0 ? JSON.stringify(specifier) : specifier;
        source = source.slice(0, item.s) + replacement + source.slice(item.e);
        changed = true;
      }
      if (changed) await writeFile(file, source);
    }
  }
  await visit(root);
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  if (!process.argv[2])
    throw new Error('Provide the compiled output directory');
  await rewriteSourceAliases(process.argv[2]);
}
