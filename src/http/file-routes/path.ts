import { posix } from 'node:path';

/** Folders define URL segments; [name] becomes an Express parameter, including [id].pdf. */
export function routePath(relativeFile: string): string {
  const directory = posix.dirname(relativeFile);
  if (directory === '.') return '/';
  const parameters = new Set<string>();
  const segments = directory.split('/').map((segment) => {
    const converted = segment.replace(
      /\[([A-Za-z_][A-Za-z0-9_]*)\]/g,
      (_, name: string) => {
        if (parameters.has(name))
          throw new Error(`Repeated route parameter: ${relativeFile}`);
        parameters.add(name);
        return `:${name}`;
      },
    );
    if (!/^[A-Za-z0-9_.:-]+$/.test(converted) || segment.includes(':'))
      throw new Error(`Invalid route folder: ${relativeFile}`);
    return converted;
  });
  return `/${segments.join('/')}`;
}
