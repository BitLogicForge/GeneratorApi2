import { sendDownload } from '@/http/download';
import { documentIdSchema, pdfUrlQuerySchema } from '@/pdf-route';
import { createDocumentPdfResolver } from '@/services/pdf/document-pdf';

import type { RequestHandler } from 'express';
import type { RouteDependencies } from '@/http/types';

/** Validates document links and sends queued PDF downloads. */
export function createDocumentPdfHandler(
  { pdf, config, queues }: RouteDependencies,
  landscape?: boolean,
): RequestHandler {
  const resolveInput = createDocumentPdfResolver(config);
  return async (req, res) => {
    const id = documentIdSchema.parse(req.params.id);
    const query = pdfUrlQuerySchema.parse(req.query);
    const input = resolveInput(id, query, landscape);
    await sendDownload(
      res,
      queues.pdf,
      () => pdf.generate(input),
      input.filename,
      'pdf',
    );
  };
}
