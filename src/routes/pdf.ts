import { Router, type RequestHandler } from 'express';
import type { RouteDependencies } from '../http/types.js';
import { generationInput } from '../http/input.js';
import { sendDownload } from '../http/download.js';
import {
  documentIdSchema,
  pdfRoutePatternSchema,
  pdfUrlQuerySchema,
  resolvePdfRoute,
} from '../pdf-route.js';
import { pdfSchema } from '../schemas.js';
import { AppError } from '../errors.js';

export function createPdfRoutes({ pdf, config, queues }: RouteDependencies) {
  const router = Router();
  const routePattern = pdfRoutePatternSchema.parse(config.pdfRoutePattern);
  router.get('/:id.pdf', async (req, res) => {
    const id = documentIdSchema.parse(req.params.id);
    const query = pdfUrlQuerySchema.parse(req.query);
    const route = resolvePdfRoute(routePattern, id);
    const target = new URL(route, 'http://webapp.invalid');
    for (const key of target.searchParams.keys()) {
      if (Object.hasOwn(query, key))
        throw new AppError(
          400,
          'RESERVED_QUERY_PARAMETER',
          `Query parameter is configured by the server: ${key}`,
        );
    }
    if (
      !target.searchParams.has('language') &&
      !Object.hasOwn(query, 'language')
    )
      query.language = config.defaultLanguage;
    const input = pdfSchema.parse({ route, query, filename: id });
    await sendDownload(
      res,
      queues.pdf,
      () => pdf.generate(input),
      input.filename,
      'pdf',
    );
  });
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
