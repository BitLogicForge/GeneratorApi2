import { rm } from 'node:fs/promises';

// Remove generated output so deleted/moved route files cannot remain active after a build.
await rm(new URL('../dist/', import.meta.url), {
  recursive: true,
  force: true,
});
