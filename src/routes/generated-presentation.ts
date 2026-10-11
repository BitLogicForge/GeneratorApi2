import { Router, type RequestHandler } from 'express';
import type { RouteDependencies } from '../http/types.js';
import { generationInput } from '../http/input.js';
import { sendDownload } from '../http/download.js';
import { presentationSchema } from '../schemas.js';

export function createGeneratedPresentationRoute({
  presentations,
  queues,
}: RouteDependencies) {
  const router = Router();
  const exportGenerated: RequestHandler<{ template: string }> = async (
    req,
    res,
  ) => {
    const input = presentationSchema.parse(generationInput(req));
    await sendDownload(
      res,
      queues.presentations,
      () => presentations.generate(req.params.template, input),
      input.filename,
      'pptx',
    );
  };
  router
    .route('/api/exports/pptx/generated/:template')
    .get(exportGenerated)
    .post(exportGenerated);
  return router;
}
