import { sendDownload } from '@/http/download';

import type { Request, RequestHandler } from 'express';
import type { ZodType } from 'zod';
import type { RouteDependencies } from '@/http/types';
import type { PdfInput } from '@/routes/api/exports/pdf/schema';

/** All PDF routes validate, prepare and send downloads through the same flow. */
export function createPdfHandler<Input>(
  { pdf, queues }: RouteDependencies,
  definition: {
    schema: ZodType<Input>;
    readInput: (req: Request<Record<string, string>>) => unknown;
    prepareInput: (input: Input) => PdfInput;
  },
): RequestHandler<Record<string, string>> {
  return async (req, res) => {
    const parsed = definition.schema.parse(definition.readInput(req));
    const input = definition.prepareInput(parsed);
    await sendDownload(
      res,
      queues.pdf,
      () => pdf.generate(input),
      input.filename,
      'pdf',
    );
  };
}
