import { Router, type RequestHandler } from 'express';
import type { RouteDependencies } from '@/http/types';
import { generationInput } from '@/http/input';
import { sendDownload } from '@/http/download';
import { presentationSchema } from '@/schemas';

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
