import { readFile } from 'node:fs/promises';

import JSZip from 'jszip';

import { AppError } from '@/errors';

import { replacePlaceholders } from './placeholders.ts';

import type { TemplatePresentationInput } from '@/schemas';

/** Mutates only text in slides and speaker notes; preserves all other ZIP parts. */
export class PowerPointTemplateService {
  private readonly templates: Map<string, string>;
  constructor(templates: Record<string, string>) {
    this.templates = new Map(Object.entries(templates));
  }

  /** Replaces paragraph tokens across formatting runs and rejects missing or unused replacement keys. */
  async generate(
    template: string,
    input: TemplatePresentationInput,
  ): Promise<Buffer> {
    // Registry lookup prevents request-controlled paths or arbitrary file reads.
    const path = this.templates.get(template);
    if (!path)
      throw new AppError(
        404,
        'UNKNOWN_TEMPLATE',
        'PowerPoint file template not found',
      );
    const source = await readFile(path);
    if (source.length > 20 * 1024 * 1024)
      throw new AppError(500, 'INVALID_TEMPLATE', 'Template exceeds 20 MB');
    const zip = await JSZip.loadAsync(source);
    if (!zip.file('[Content_Types].xml') || !zip.file('ppt/presentation.xml')) {
      throw new AppError(
        500,
        'INVALID_TEMPLATE',
        'Template must be a valid PPTX presentation',
      );
    }
    await replacePlaceholders(zip, input.replacements);
    return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  }
}
