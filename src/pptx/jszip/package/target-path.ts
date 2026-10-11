import { posix } from 'node:path';

export const targetPath = (owner: string, target: string) =>
  target.startsWith('/')
    ? target.slice(1)
    : posix.normalize(posix.join(posix.dirname(owner), target));
