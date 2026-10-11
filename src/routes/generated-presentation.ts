import { Router, type RequestHandler } from 'express';
import type { RouteDependencies } from '../http/types.ts';
import { generationInput } from '../http/input.ts';
import { sendDownload } from '../http/download.ts';
import { presentationSchema } from '../schemas.ts';

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
