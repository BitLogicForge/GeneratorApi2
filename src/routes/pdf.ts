import { Router, type RequestHandler } from 'express';
import type { RouteDependencies } from '../http/types.js';
import { generationInput } from '../http/input.js';
import { sendDownload } from '../http/download.js';
import { resolvePdfRoute } from '../pdf-route.js';

export function createPdfRoutes({ pdf, config }: RouteDependencies) {
  const router = Router();
  router.get('/:id.pdf', async (req, res) => {
    const id = req.params.id;
    const route = resolvePdfRoute(config.pdfRoutePattern, id);
    const query = { ...req.query } as Record<string, string>;
    if (!new URL(route, 'http://webapp.invalid').searchParams.has('language'))
      query.language ??= config.defaultLanguage;
    await sendDownload(
      res,
      () =>
        pdf.generate({
          route,
          query,
          filename: id,
          format: 'A4',
          landscape: false,
        }),
      id,
      'pdf',
    );
  });
  const exportPdf: RequestHandler = async (req, res) => {
    const input = {
      query: {},
      filename: 'document',
      format: 'A4',
      landscape: false,
      ...generationInput(req),
    };
    await sendDownload(res, () => pdf.generate(input), input.filename, 'pdf');
  };
  router.route('/api/exports/pdf').get(exportPdf).post(exportPdf);
  return router;
}
