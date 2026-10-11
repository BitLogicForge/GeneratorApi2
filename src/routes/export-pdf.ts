import { Router, type RequestHandler } from 'express';
import type { RouteDependencies } from '../http/types.ts';
import { generationInput } from '../http/input.ts';
import { sendDownload } from '../http/download.ts';
import { pdfSchema } from '../schemas.ts';

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
