import { sendDownload } from '@/http/download';
import { decodeExportInput } from '@/http/input';
import {
  pdfPrintOverridesSchema,
  pdfRenderSchema,
} from '@/services/pdf/contracts';

import type { Request } from 'express';
import type { z, ZodType } from 'zod';
import type { RouteFactory } from '@/http/file-routes/types';
import type { RouteDependencies } from '@/http/types';
import type { PdfPrintOverrides } from '@/services/pdf/contracts';

export interface PdfReport<Input> {
  schema: ZodType<Input>;
  prepareInput: (
    input: Input,
    config: RouteDependencies['config'],
  ) => z.input<typeof pdfRenderSchema>;
  readRequestInput?: (request: Request<Record<string, string>>) => unknown;
  jsonFields?: readonly string[];
  print?: PdfPrintOverrides;
}

export function definePdfReport<Input>(
  definition: PdfReport<Input>,
): RouteFactory {
  return (dependencies) => {
    const print =
      definition.print === undefined
        ? undefined
        : pdfPrintOverridesSchema.parse(definition.print);
    return async (req, res) => {
      const raw = definition.readRequestInput
        ? definition.readRequestInput(req)
        : decodeExportInput(req, definition.jsonFields ?? []);
      const parsed = definition.schema.parse(raw);
      const input = pdfRenderSchema.parse({
        ...(print?.format !== undefined && { format: print.format }),
        ...(print?.landscape !== undefined && { landscape: print.landscape }),
        ...definition.prepareInput(parsed, dependencies.config),
        ...(print !== undefined && { print }),
      });
      await sendDownload(
        res,
        dependencies.queues.pdf,
        () => dependencies.pdf.generate(input),
        input.filename,
        'pdf',
      );
    };
  };
}
