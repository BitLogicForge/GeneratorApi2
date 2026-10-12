import { AppError } from '@/errors';
import { sendDownload } from '@/http/download';
import { decodeExportInput } from '@/http/input';
import { filenameSchema } from '@/validation/filename';

import type { Request } from 'express';
import type { ZodType } from 'zod';
import type { RouteFactory } from '@/http/file-routes/types';
import type { RouteDependencies } from '@/http/types';
import type { ReportService, ServiceDefinition } from './services.ts';

export interface PptxReport<Input> extends ServiceDefinition<Input> {
  schema: ZodType<Input>;
  filename: string | ((input: Input) => string);
  jsonFields?: readonly string[];
  readRequestInput?: (request: Request<Record<string, string>>) => unknown;
  notConfiguredMessage?: string;
  // Compatibility with existing createApp service injections.
  injectedService?: (
    dependencies: RouteDependencies,
  ) => ReportService<Input> | undefined;
}

/** Defines request validation, generation, and lifecycle together with the report. */
export function definePptxReport<Input>(
  definition: PptxReport<Input>,
): RouteFactory {
  return (dependencies) => {
    const service =
      definition.injectedService?.(dependencies) ??
      dependencies.reports?.get(definition);
    return async (req, res) => {
      const raw = definition.readRequestInput
        ? definition.readRequestInput(req)
        : decodeExportInput(req, definition.jsonFields ?? []);
      const input = definition.schema.parse(raw);
      if (!service)
        throw new AppError(
          404,
          'UNKNOWN_TEMPLATE',
          definition.notConfiguredMessage ?? 'PowerPoint report not configured',
        );
      const filename = filenameSchema.parse(
        typeof definition.filename === 'function'
          ? definition.filename(input)
          : definition.filename,
      );
      await sendDownload(
        res,
        dependencies.queues.presentations,
        () => service.generate(input),
        filename,
        'pptx',
      );
    };
  };
}
