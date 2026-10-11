import { posix } from 'node:path';

export const relsPath = (path: string) =>
  posix.join(posix.dirname(path), '_rels', `${posix.basename(path)}.rels`);
