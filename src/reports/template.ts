import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PowerPointTemplateService } from '@/services/jszip/power-point-template-service';

import { templateFilenameSchema } from './schema.ts';

import type { PptxRenderInput } from '@/services/jszip/schema';
import type { PptxReport } from './pptx.ts';

/** A trusted file registered by code, never a request-controlled filesystem path. */
export function templateFile(filename: string) {
  if (!templateFilenameSchema.safeParse(filename).success)
    throw new Error('Use a template filename without directories');
  const fromCwd = resolve(process.cwd(), 'templates', filename);
  if (existsSync(fromCwd)) return fromCwd;
  let current = dirname(fileURLToPath(import.meta.url));
  while (true) {
    const candidate = join(current, 'templates', filename);
    if (existsSync(candidate)) return candidate;
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return fromCwd;
}

/**
 * Template loading and generation only; each route owns its public contract.
 * @public
 */
export function templateService(
  name: string,
  filename: string,
): Pick<PptxReport<unknown, PptxRenderInput>, 'createService'> {
  return {
    createService: () => {
      const service = new PowerPointTemplateService({
        [name]: templateFile(filename),
      });
      return {
        generate: (input) => service.generate(name, input),
        validate: () => service.validate(),
      };
    },
  };
}
