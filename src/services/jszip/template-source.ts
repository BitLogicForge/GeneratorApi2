import { readFile } from 'node:fs/promises';

import JSZip from 'jszip';

import { AppError } from '@/errors';

/** Retains validated source bytes; callers must load their own mutable archive. */
export class TemplateSource {
  private source: Promise<Buffer> | undefined;

  constructor(
    private readonly path: string,
    private readonly validateArchive: (zip: JSZip) => Promise<void>,
  ) {}

  load(): Promise<Buffer> {
    this.source ??= this.read().catch((error: unknown) => {
      this.source = undefined;
      const message = error instanceof Error ? error.message : String(error);
      const failure = new AppError(
        error instanceof AppError ? error.status : 500,
        error instanceof AppError ? error.code : 'INVALID_TEMPLATE',
        `Template "${this.path}": ${message}`,
      );
      failure.cause = error;
      throw failure;
    });
    return this.source;
  }

  private async read(): Promise<Buffer> {
    const source = await readFile(this.path);
    if (source.length > 20 * 1024 * 1024)
      throw new AppError(500, 'INVALID_TEMPLATE', 'Template exceeds 20 MB');
    const zip = await JSZip.loadAsync(source);
    if (!zip.file('[Content_Types].xml') || !zip.file('ppt/presentation.xml'))
      throw new AppError(
        500,
        'INVALID_TEMPLATE',
        'Template must be a valid PPTX presentation',
      );
    await this.validateArchive(zip);
    return source;
  }
}
