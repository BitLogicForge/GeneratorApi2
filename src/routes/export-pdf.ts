import { Router, type RequestHandler } from 'express';
import type { RouteDependencies } from '@/http/types';
import { generationInput } from '@/http/input';
import { sendDownload } from '@/http/download';
import { pdfSchema } from '@/schemas';

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
