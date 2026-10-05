import { Router, type RequestHandler } from 'express';
import type { RouteDependencies } from '../http/types.js';
import { generationInput } from '../http/input.js';
import { sendDownload } from '../http/download.js';

export function createPresentationRoutes({
  presentations,
  templatePresentations,
  templateReportDemo,
}: RouteDependencies) {
  const router = Router();
  router.get('/demo-report.pptx', async (req, res) => {
    await sendDownload(
      res,
      () =>
        templateReportDemo!.generate(
          (req.query.TEXT_ME ?? 'Generated report') as string,
        ),
      'demo-report',
      'pptx',
    );
  });
  const exportGenerated: RequestHandler<{ template: string }> = async (
    req,
    res,
  ) => {
    const input = {
      filename: 'presentation',
      subtitle: '',
      author: 'Generator API',
      accent: '2563EB',
      ...generationInput(req),
    };
    await sendDownload(
      res,
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
    const input = { filename: 'presentation', ...generationInput(req) };
    await sendDownload(
      res,
      () => templatePresentations!.generate(req.params.template, input),
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
