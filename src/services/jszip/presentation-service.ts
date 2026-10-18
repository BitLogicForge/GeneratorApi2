import { TemplateSource } from './template-source.ts';

import type { ReportService } from '@/reports/services';
import type { TemplateDeck, TemplateSettings } from './template-settings.ts';

/** Shared base contract for JSZip template presentation services: fetch -> prepare -> render. */
export abstract class PresentationService<
  Settings extends TemplateSettings,
  Input,
  RawData,
  PreparedData,
> implements ReportService<Input> {
  private readonly source: TemplateSource<Settings>;

  constructor(path: string, settings: Settings) {
    this.source = new TemplateSource(path, settings);
  }

  async validate(): Promise<void> {
    await this.source.load();
  }

  /** Orchestrates upstream data fetching, data transformation, and PowerPoint rendering. */
  async generate(input: Input): Promise<Buffer> {
    const raw = await this.fetchData(input);
    const prepared = await this.prepareData(input, raw);
    const deck = await this.source.open();
    await this.renderDeck(deck, prepared);
    return deck.toBuffer();
  }

  /** Step 1: Fetches raw data for the presentation. */
  protected abstract fetchData(input: Input): Promise<RawData> | RawData;

  /** Step 2: Transforms request input and raw data into presentation-ready values. */
  protected abstract prepareData(input: Input, raw: RawData): Promise<PreparedData> | PreparedData;

  /** Step 3: Populates the opened PowerPoint template deck with prepared values. */
  protected abstract renderDeck(
    deck: TemplateDeck<Settings>,
    prepared: PreparedData,
  ): Promise<void> | void;
}
