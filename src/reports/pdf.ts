import { sendDownload } from '@/http/download';
import { decodeExportInput } from '@/http/input';
import {
  pdfOriginSchema,
  pdfPrintOverridesSchema,
  pdfRenderSchema,
} from '@/services/pdf/contracts';

import type { Request } from 'express';
import type { z, ZodType } from 'zod';
import type { RouteDependencies, RouteFactory } from '@/http/types';
import type { PdfPrintOverrides } from '@/services/pdf/contracts';

// Report print settings have one owner: definition.print.
const preparedInputSchema = pdfRenderSchema.omit({
  landscape: true,
  print: true,
});

type PreparedPdfInput = z.input<typeof preparedInputSchema> & {
  landscape?: never;
  print?: never;
};

export interface PdfReport<Input> {
  schema: ZodType<Input>;
  prepareInput: (
    input: Input,
    config: RouteDependencies['config'],
  ) => PreparedPdfInput;
  readRequestInput?: (request: Request<Record<string, string>>) => unknown;
  jsonFields?: readonly string[];
  print?: PdfPrintOverrides;
  externalOrigin?: string;
}

export function definePdfReport<Input>(
  definition: PdfReport<Input>,
): RouteFactory {
  return (dependencies) => {
    const externalOrigin =
      definition.externalOrigin === undefined
        ? undefined
        : pdfOriginSchema.parse(definition.externalOrigin);
    const print =
      definition.print === undefined
        ? undefined
        : pdfPrintOverridesSchema.parse(definition.print);
    return async (req, res) => {
      const raw = definition.readRequestInput
        ? definition.readRequestInput(req)
        : decodeExportInput(req, definition.jsonFields ?? []);
      const parsed = definition.schema.parse(raw);
      const prepared = preparedInputSchema.parse(
        definition.prepareInput(parsed, dependencies.config),
      );
      const input = pdfRenderSchema.parse({
        ...prepared,
        ...(print?.format !== undefined && { format: print.format }),
        ...(print?.landscape !== undefined && { landscape: print.landscape }),
        ...(print !== undefined && { print }),
      });
      await sendDownload(
        res,
        dependencies.queues.pdf,
        () => dependencies.pdf.generate(input, externalOrigin),
        input.filename,
        'pdf',
      );
    };
  };
}
