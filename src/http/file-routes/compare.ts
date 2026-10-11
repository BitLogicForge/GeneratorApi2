import type { FileRoute } from './types.ts';

/** Static segments and more specific suffixes precede parameter routes; HEAD precedes GET. */
export function compareRoutes(
  left: Pick<FileRoute, 'path' | 'method'>,
  right: Pick<FileRoute, 'path' | 'method'>,
): number {
  const a = left.path.split('/');
  const b = right.path.split('/');
  for (let index = 0; index < Math.max(a.length, b.length); index++) {
    if (a[index] === undefined || b[index] === undefined)
      return b.length - a.length;
    const dynamic =
      Number(a[index].includes(':')) - Number(b[index].includes(':'));
    if (dynamic) return dynamic;
    if (a[index].includes(':') && b[index].includes(':')) {
      const literal =
        b[index].replace(/:[A-Za-z_][A-Za-z0-9_]*/g, '').length -
        a[index].replace(/:[A-Za-z_][A-Za-z0-9_]*/g, '').length;
      if (literal) return literal;
    }
  }
  return (
    Number(right.method === 'head') - Number(left.method === 'head') ||
    left.path.localeCompare(right.path) ||
    left.method.localeCompare(right.method)
  );
}
