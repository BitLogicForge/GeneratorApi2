import pptxgen from 'pptxgenjs';

import { ErrorCode } from '@/constants';
import { AppError } from '@/errors';
import { briefTemplate } from '@/pptx/pptxgenjs/templates/brief';
import { ReportErrorMessage } from '@/reports/constants';

import type { PresentationTemplate } from '@/pptx/pptxgenjs/types';
import type { BriefInput } from './schema.ts';

export class PowerPointGenerationService {
  private readonly templates: Map<string, PresentationTemplate>;
  constructor(templates: Record<string, PresentationTemplate> = { brief: briefTemplate }) {
    this.templates = new Map(Object.entries(templates));
  }
  /** Runs a registered design on a fresh deck to keep request content and metadata isolated. */
  async generate(template: string, input: BriefInput) {
    const render = this.templates.get(template);
    if (!render)
      throw new AppError(
        404,
        ErrorCode.UnknownTemplate,
        ReportErrorMessage.PresentationTemplateNotFound,
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
