import { access } from 'node:fs/promises';

import { Automizer } from 'pptx-automizer';

import { ErrorCode } from '@/constants';
import { AppError } from '@/errors';

import type { SlideItemModifier, SlideModifier } from '@/pptx/automizer';
import type { ReportService } from '@/reports/services';

/**
 * High-level presentation builder facilitating slide addition, duplication,
 * and data-driven repetition using pptx-automizer.
 */
export class PresentationBuilder {
  constructor(
    public readonly automizer: Automizer,
    public readonly defaultTemplate: string = 'template',
  ) {}

  /**
   * Adds a slide from the specified (or default) template deck.
   * Slide numbers are 1-based.
   */
  addSlide(
    slideNumber: number,
    callback?: SlideModifier,
    templateName: string = this.defaultTemplate,
  ): this {
    this.automizer.addSlide(templateName, slideNumber, callback);
    return this;
  }

  /**
   * Duplicates a slide from the template.
   * Calling this creates an independent copy of the template slide with its own
   * charts, tables, and shapes that can be customized via the callback.
   */
  duplicateSlide(
    slideNumber: number,
    callback?: SlideModifier,
    templateName: string = this.defaultTemplate,
  ): this {
    return this.addSlide(slideNumber, callback, templateName);
  }

  /**
   * Repeats (duplicates) a template slide for each element in an array.
   * Eliminates manual loops when creating data-driven multi-slide reports.
   */
  repeatSlide<T>(
    slideNumber: number,
    items: readonly T[],
    callback: SlideItemModifier<T>,
    templateName: string = this.defaultTemplate,
  ): this {
    for (let index = 0; index < items.length; index++) {
      const item = items[index];
      this.addSlide(
        slideNumber,
        (slide) => callback(slide, item, index),
        templateName,
      );
    }
    return this;
  }

  /** Loads an additional template file or buffer into the automizer session. */
  loadTemplate(pathOrBuffer: string | Buffer, name: string): this {
    this.automizer.load(pathOrBuffer, name);
    return this;
  }
}

/**
 * Base presentation service using pptx-automizer.
 * Provides a clean 3-step lifecycle: fetchData -> prepareData -> renderPresentation.
 */
export abstract class AutomizerPresentationService<
  Input,
  RawData,
  PreparedData,
> implements ReportService<Input> {
  constructor(protected readonly path: string) {}

  async validate(): Promise<void> {
    try {
      await access(this.path);
    } catch (error) {
      throw new AppError(
        500,
        ErrorCode.InvalidTemplate,
        `Template "${this.path}" is not accessible: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /** Orchestrates upstream data fetching, preparation, and presentation rendering. */
  async generate(input: Input): Promise<Buffer> {
    const raw = await this.fetchData(input);
    const prepared = await this.prepareData(input, raw);

    const automizer = new Automizer({
      removeExistingSlides: true,
      autoImportSlideMasters: true,
      cleanup: false,
      cleanupPlaceholders: false,
      verbosity: 0,
    });

    automizer.loadRoot(this.path).load(this.path, 'template');

    const builder = new PresentationBuilder(automizer, 'template');
    await this.renderPresentation(builder, prepared);

    const zip = await automizer.getJSZip();
    return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  }

  /** Step 1: Fetches raw data from upstream APIs or data services. */
  protected abstract fetchData(input: Input): Promise<RawData> | RawData;

  /** Step 2: Transforms raw data into presentation-ready structures. */
  protected abstract prepareData(
    input: Input,
    raw: RawData,
  ): Promise<PreparedData> | PreparedData;

  /** Step 3: Populates slides and duplicates repeatable pages using pptx-automizer. */
  protected abstract renderPresentation(
    builder: PresentationBuilder,
    prepared: PreparedData,
  ): Promise<void> | void;
}
