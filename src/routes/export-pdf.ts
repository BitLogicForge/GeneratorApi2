import { Router, type RequestHandler } from 'express';
import type { RouteDependencies } from '../http/types.js';
import { generationInput } from '../http/input.js';
import { sendDownload } from '../http/download.js';
import { pdfSchema } from '../schemas.js';

export function createExportPdfRoute({ pdf, queues }: RouteDependencies) {
  const router = Router();
  const exportPdf: RequestHandler = async (req, res) => {
    const input = pdfSchema.parse(generationInput(req));
    await sendDownload(
      res,
      queues.pdf,
      () => pdf.generate(input),
      input.filename,
      'pdf',
    );
  };
  router.route('/api/exports/pdf').get(exportPdf).post(exportPdf);
  return router;
}
