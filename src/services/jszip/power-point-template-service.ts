import JSZip from 'jszip';

import { AppError } from '@/errors';
import { replacePlaceholders } from '@/pptx/jszip/placeholders';

import { TemplateSource } from './template-source.ts';

import type { PptxRenderInput } from './contracts.ts';

/** Mutates only text in slides and speaker notes; preserves all other ZIP parts. */
export class PowerPointTemplateService {
  private readonly templates: Map<string, TemplateSource>;
  constructor(templates: Record<string, string>) {
    this.templates = new Map(
      Object.entries(templates).map(([name, path]) => [
        name,
        new TemplateSource(path, async () => {}),
      ]),
    );
  }

  async validate() {
    await Promise.all(
      [...this.templates.values()].map((source) => source.load()),
    );
  }

  /** Replaces paragraph tokens across formatting runs and rejects missing or unused replacement keys. */
  async generate(template: string, input: PptxRenderInput): Promise<Buffer> {
    // Registry lookup prevents request-controlled paths or arbitrary file reads.
    const source = this.templates.get(template);
    if (!source)
      throw new AppError(
        404,
        'UNKNOWN_TEMPLATE',
        'PowerPoint file template not found',
      );
    const zip = await JSZip.loadAsync(await source.load());
    await replacePlaceholders(zip, input.replacements);
    return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  }
}
