import { ExportFormat } from '@/http/constants';
import { sendDownload } from '@/http/download';
import { decodeExportInput } from '@/http/input';
import { pdfOriginSchema, pdfPrintOverridesSchema, pdfRenderSchema } from '@/services/pdf/schema';

import { preparedInputSchema } from './schema.ts';

import type { Request } from 'express';
import type { ZodType } from 'zod';
import type { RouteDependencies, RouteFactory } from '@/http/types';
import type { PdfPrintOverrides } from '@/services/pdf/schema';
import type { PreparedPdfInput } from './schema.ts';

export interface PdfReport<Input> {
  schema: ZodType<Input>;
  prepareInput: (input: Input, config: RouteDependencies['config']) => PreparedPdfInput;
  readRequestInput?: (request: Request<Record<string, string>>) => unknown;
  jsonFields?: readonly string[];
  print?: PdfPrintOverrides;
  externalOrigin?: string;
}

export function definePdfReport<Input>(definition: PdfReport<Input>): RouteFactory {
  return (dependencies) => {
    const externalOrigin =
      definition.externalOrigin === undefined
        ? undefined
        : pdfOriginSchema.parse(definition.externalOrigin);
    const print =
      definition.print === undefined ? undefined : pdfPrintOverridesSchema.parse(definition.print);
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
        format: print?.format ?? prepared.format,
        landscape: print?.landscape,
        print,
      });
      await sendDownload(
        res,
        dependencies.queues.pdf,
        () => dependencies.pdf.generate(input, externalOrigin),
        input.filename,
        ExportFormat.Pdf,
      );
    };
  };
}
