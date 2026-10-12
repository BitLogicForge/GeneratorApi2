import { fileURLToPath } from 'node:url';

import { pptxRenderSchema } from '@/services/jszip/contracts';
import { PowerPointTemplateService } from '@/services/jszip/power-point-template-service';

import type { PptxRenderInput } from '@/services/jszip/contracts';
import type { PptxReport } from './pptx.ts';

/** A trusted file registered by code, never a request-controlled filesystem path. */
export function templateFile(filename: string) {
  if (!/^[A-Za-z0-9_-]+\.pptx$/.test(filename))
    throw new Error('Use a template filename without directories');
  return fileURLToPath(new URL(`../../templates/${filename}`, import.meta.url));
}

export function templateReport(
  name: string,
  filename = `${name}.pptx`,
): PptxReport<PptxRenderInput> {
  return {
    schema: pptxRenderSchema,
    notConfiguredMessage: 'PowerPoint file template not found',
    jsonFields: ['replacements'],
    filename: (input) => input.filename,
    createService: () => {
      const service = new PowerPointTemplateService({
        [name]: templateFile(filename),
      });
      return {
        generate: (input) => service.generate(name, input),
        validate: () => service.validate(),
      };
    },
    injectedService: ({ templatePresentations }) =>
      templatePresentations && {
        generate: (input) => templatePresentations.generate(name, input),
      },
  };
}
