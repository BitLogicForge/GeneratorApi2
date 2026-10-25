import { ExportFormat } from '@/http/constants';
import { sendDownload } from '@/http/download';
import { decodeExportInput } from '@/http/input';
import { pdfOriginSchema, pdfPrintOverridesSchema, pdfRenderSchema } from '@/services/pdf/schema';
import { parseInternal } from '@/validation/internal';

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
  allowHttp404?: boolean;
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
      const prepared = parseInternal(
        preparedInputSchema,
        definition.prepareInput(parsed, dependencies.config),
        `PDF report input for ${req.route?.path ?? req.path}`,
      );
      const allowHttp404 =
        prepared.allowHttp404 ?? definition.allowHttp404 ?? dependencies.config.allowHttp404;
      const input = parseInternal(
        pdfRenderSchema,
        {
          ...prepared,
          format: print?.format ?? prepared.format,
          landscape: print?.landscape,
          print,
          allowHttp404,
        },
        `PDF render input for ${req.route?.path ?? req.path}`,
      );
      await sendDownload(
        res,
        dependencies.queues.pdf,
        (signal) => dependencies.pdf.generate(input, externalOrigin, signal),
        input.filename,
        ExportFormat.Pdf,
      );
    };
  };
}
