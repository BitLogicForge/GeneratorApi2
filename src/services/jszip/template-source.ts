import { readFile } from 'node:fs/promises';
import JSZip from 'jszip';

import { ErrorCode } from '@/constants';
import { AppError } from '@/errors';
import { PackagePath, PptxErrorMessage } from '@/pptx/jszip/package/constants';

import { bindTemplateSettings } from './template-settings.ts';

import type { TemplateDeck, TemplateSettings } from './template-settings.ts';

/** Retains validated source bytes; callers must load their own mutable archive. */
export class TemplateSource<Settings extends TemplateSettings = Record<never, never>> {
  private source: Promise<Buffer> | undefined;
  private readonly settings: Settings | undefined;
  private readonly validateArchive: (zip: JSZip) => Promise<void>;

  constructor(
    private readonly path: string,
    settingsOrValidate?: Settings | ((zip: JSZip) => Promise<void>),
  ) {
    if (typeof settingsOrValidate === 'function') {
      this.validateArchive = settingsOrValidate;
    } else if (settingsOrValidate) {
      this.settings = settingsOrValidate;
      this.validateArchive = async (zip) => {
        await bindTemplateSettings(zip, settingsOrValidate);
      };
    } else {
      this.validateArchive = async () => {};
    }
  }

  load(): Promise<Buffer> {
    this.source ??= this.read().catch((error: unknown) => {
      this.source = undefined;
      const message = error instanceof Error ? error.message : String(error);
      const failure = new AppError(
        error instanceof AppError ? error.status : 500,
        error instanceof AppError ? error.code : ErrorCode.InvalidTemplate,
        `Template "${this.path}": ${message}`,
      );
      failure.cause = error;
      throw failure;
    });
    return this.source;
  }

  /** Opens a fresh mutable copy of the validated template archive with bound handles for all configured `templateSettings` objects. */
  async open(): Promise<TemplateDeck<Settings>> {
    const zip = await JSZip.loadAsync(await this.load());
    return bindTemplateSettings(zip, (this.settings ?? {}) as Settings);
  }

  private async read(): Promise<Buffer> {
    const source = await readFile(this.path);
    if (source.length > 20 * 1024 * 1024)
      throw new AppError(500, ErrorCode.InvalidTemplate, PptxErrorMessage.TemplateExceedsMaxSize);
    const zip = await JSZip.loadAsync(source);
    if (!zip.file(PackagePath.ContentTypes) || !zip.file(PackagePath.Presentation))
      throw new AppError(500, ErrorCode.InvalidTemplate, PptxErrorMessage.TemplateInvalidPptx);
    await this.validateArchive(zip);
    return source;
  }
}
