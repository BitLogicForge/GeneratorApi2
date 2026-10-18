import { ErrorCode } from '@/constants';
import { AppError } from '@/errors';
import { ExportFormat } from '@/http/constants';
import { sendDownload } from '@/http/download';
import { decodeExportInput } from '@/http/input';
import { filenameSchema } from '@/validation/schema';

import { ReportErrorMessage } from './constants.ts';

import type { Request } from 'express';
import type { ZodType } from 'zod';
import type { RouteDependencies, RouteFactory } from '@/http/types';
import type { ServiceDefinition } from './services.ts';

export interface PptxReport<
  Input,
  RenderInput = Input,
> extends ServiceDefinition<RenderInput> {
  schema: ZodType<Input>;
  prepareInput: (
    input: Input,
    config: RouteDependencies['config'],
  ) => { filename: string; input: RenderInput };
  jsonFields?: readonly string[];
  readRequestInput?: (request: Request<Record<string, string>>) => unknown;
  notConfiguredMessage?: string;
}

/** Defines request validation, generation, and lifecycle together with the report. */
export function definePptxReport<Input, RenderInput>(
  definition: PptxReport<Input, RenderInput>,
): RouteFactory {
  return (dependencies) => {
    const service = dependencies.reports?.get(definition);
    return async (req, res) => {
      const raw = definition.readRequestInput
        ? definition.readRequestInput(req)
        : decodeExportInput(req, definition.jsonFields ?? []);
      const input = definition.schema.parse(raw);
      if (!service)
        throw new AppError(
          404,
          ErrorCode.UnknownTemplate,
          definition.notConfiguredMessage ??
            ReportErrorMessage.PowerPointReportNotConfigured,
        );
      const prepared = definition.prepareInput(input, dependencies.config);
      const filename = filenameSchema.parse(prepared.filename);
      await sendDownload(
        res,
        dependencies.queues.presentations,
        () => service.generate(prepared.input),
        filename,
        ExportFormat.Pptx,
      );
    };
  };
}
