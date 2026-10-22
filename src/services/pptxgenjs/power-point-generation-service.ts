import pptxgen from 'pptxgenjs';

import { ErrorCode } from '@/constants';
import { AppError } from '@/errors';
import { briefLayout } from '@/pptx/pptxgenjs/layouts/brief';
import { ReportErrorMessage } from '@/reports/constants';

import type { PresentationLayout } from '@/pptx/pptxgenjs/types';
import type { BriefInput } from './schema.ts';

export class PowerPointGenerationService {
  private readonly layouts: Map<string, PresentationLayout>;
  constructor(layouts: Record<string, PresentationLayout> = { brief: briefLayout }) {
    this.layouts = new Map(Object.entries(layouts));
  }
  /** Runs a registered design on a fresh deck to keep request content and metadata isolated. */
  async generate(layout: string, input: BriefInput) {
    const render = this.layouts.get(layout);
    if (!render)
      throw new AppError(
        404,
        ErrorCode.UnknownTemplate,
        ReportErrorMessage.PresentationLayoutNotFound,
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
