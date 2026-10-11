import { Router, type RequestHandler } from 'express';
import type { RouteDependencies } from '@/http/types';
import { generationInput } from '@/http/input';
import { sendDownload } from '@/http/download';
import { templatePresentationSchema } from '@/schemas';
import { AppError } from '@/errors';

export function createTemplatePresentationRoute({
  templatePresentations,
  queues,
}: RouteDependencies) {
  const router = Router();
  const exportTemplate: RequestHandler<{ template: string }> = async (
    req,
    res,
  ) => {
    const input = templatePresentationSchema.parse(generationInput(req));
    if (!templatePresentations)
      throw new AppError(
        404,
        'UNKNOWN_TEMPLATE',
        'PowerPoint file template not found',
      );
    await sendDownload(
      res,
      queues.presentations,
      () => templatePresentations.generate(req.params.template, input),
      input.filename,
      'pptx',
    );
  };
  router
    .route('/api/exports/pptx/templates/:template')
    .get(exportTemplate)
    .post(exportTemplate);
  return router;
}
