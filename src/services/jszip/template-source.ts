import { readFile } from 'node:fs/promises';
import JSZip from 'jszip';

import { ErrorCode } from '@/constants';
import { AppError } from '@/errors';
import { PackagePath, PptxErrorMessage } from '@/pptx/jszip/package/constants';

import { bindTemplateSettings } from './template-settings.ts';

import type { TemplateDeck, TemplateSettings } from './template-settings.ts';

interface TemplateSourceOptions<Settings extends TemplateSettings> {
  settings?: Settings;
  prepareTemplate?: (zip: JSZip) => Promise<void> | void;
}

type TemplateSourceConfig<Settings extends TemplateSettings> =
  Settings | ((zip: JSZip) => Promise<void>) | TemplateSourceOptions<Settings>;

function isTemplateSourceOptions<Settings extends TemplateSettings>(
  value: unknown,
): value is TemplateSourceOptions<Settings> {
  return (
    typeof value === 'object' &&
    value !== null &&
    ('settings' in value || 'prepareTemplate' in value)
  );
}

/** Retains validated source bytes; callers must load their own mutable archive. */
export class TemplateSource<Settings extends TemplateSettings = Record<never, never>> {
  private source: Promise<Buffer> | undefined;
  private readonly settings: Settings | undefined;
  private readonly prepare: ((zip: JSZip) => Promise<void> | void) | undefined;
  private readonly validateArchive: (zip: JSZip) => Promise<void>;

  constructor(
    private readonly path: string,
    settingsOrValidate?: TemplateSourceConfig<Settings>,
  ) {
    if (typeof settingsOrValidate === 'function') {
      this.validateArchive = settingsOrValidate;
    } else if (isTemplateSourceOptions<Settings>(settingsOrValidate)) {
      this.settings = settingsOrValidate.settings;
      this.prepare = settingsOrValidate.prepareTemplate;
      this.validateArchive = async (zip) => {
        if (this.settings) await bindTemplateSettings(zip, this.settings);
      };
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
      throw new AppError(
        error instanceof AppError ? error.status : 500,
        error instanceof AppError ? error.code : ErrorCode.InvalidTemplate,
        `Template "${this.path}": ${message}`,
        { cause: error, details: { templatePath: this.path } },
      );
    });
    return this.source;
  }

  /** Opens a fresh mutable copy of the validated template archive with bound handles for all configured `templateSettings` objects. */
  async open(): Promise<TemplateDeck<Settings>> {
    const zip = await JSZip.loadAsync(await this.load());
    await this.prepare?.(zip);
    return bindTemplateSettings(zip, (this.settings ?? {}) as Settings);
  }

  private async read(): Promise<Buffer> {
    const source = await readFile(this.path);
    if (source.length > 20 * 1024 * 1024)
      throw new AppError(500, ErrorCode.InvalidTemplate, PptxErrorMessage.TemplateExceedsMaxSize);
    const zip = await JSZip.loadAsync(source);
    if (!zip.file(PackagePath.ContentTypes) || !zip.file(PackagePath.Presentation))
      throw new AppError(500, ErrorCode.InvalidTemplate, PptxErrorMessage.TemplateInvalidPptx);
    await this.prepare?.(zip);
    await this.validateArchive(zip);
    return source;
  }
}
