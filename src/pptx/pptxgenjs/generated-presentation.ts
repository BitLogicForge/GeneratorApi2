import pptxgen from 'pptxgenjs';

import { AppError } from '@/errors';

import { briefTemplate } from './templates/brief.ts';

import type { PresentationInput } from '@/schemas';
import type { PresentationTemplate } from './types.ts';

export class GeneratedPresentationService {
  private readonly templates: Map<string, PresentationTemplate>;
  constructor(
    templates: Record<string, PresentationTemplate> = { brief: briefTemplate },
  ) {
    this.templates = new Map(Object.entries(templates));
  }
  /** Runs a registered design on a fresh deck to keep request content and metadata isolated. */
  async generate(template: string, input: PresentationInput) {
    const render = this.templates.get(template);
    if (!render)
      throw new AppError(
        404,
        'UNKNOWN_TEMPLATE',
        'Presentation template not found',
      );
    const deck = new pptxgen();
    deck.layout = 'LAYOUT_WIDE';
    deck.author = input.author;
    deck.subject = input.subtitle;
    deck.title = input.title;
    deck.theme = { headFontFace: 'Aptos Display', bodyFontFace: 'Aptos' };
    await render(deck, input);
    return (await deck.write({
      outputType: 'nodebuffer',
      compression: true,
    })) as Buffer;
  }
}
