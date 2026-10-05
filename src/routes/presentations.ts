import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import type { RouteDependencies } from '../http/types.js';
import { generationInput } from '../http/input.js';
import { sendDownload } from '../http/download.js';
import { presentationSchema, templatePresentationSchema } from '../schemas.js';
import { AppError } from '../errors.js';

const demoQuerySchema = z
  .object({ TEXT_ME: z.string().max(5000).default('Generated report') })
  .strict();

export function createPresentationRoutes({
  presentations,
  templatePresentations,
  templateReportDemo,
  queues,
}: RouteDependencies) {
  const router = Router();
  router.get('/demo-report.pptx', async (req, res) => {
    const input = demoQuerySchema.parse(req.query);
    if (!templateReportDemo)
      throw new AppError(
        404,
        'UNKNOWN_TEMPLATE',
        'Template report demo not configured',
      );
    await sendDownload(
      res,
      queues.presentations,
      () => templateReportDemo.generate(input.TEXT_ME),
      'demo-report',
      'pptx',
    );
  });
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
