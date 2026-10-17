import { fileURLToPath } from 'node:url';

import { PowerPointTemplateService } from '@/services/jszip/power-point-template-service';

import type { PptxRenderInput } from '@/services/jszip/contracts';
import type { PptxReport } from './pptx.ts';

/** A trusted file registered by code, never a request-controlled filesystem path. */
export function templateFile(filename: string) {
  if (!/^[A-Za-z0-9_-]+\.pptx$/.test(filename))
    throw new Error('Use a template filename without directories');
  return fileURLToPath(new URL(`../../templates/${filename}`, import.meta.url));
}

/** Template loading and generation only; each route owns its public contract. */
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
