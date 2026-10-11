import { Router } from 'express';
import type { RouteDependencies } from '@/http/types';
import { z } from 'zod';
import { sendDownload } from '@/http/download';
import { AppError } from '@/errors';

const demoQuerySchema = z
  .object({ TEXT_ME: z.string().max(5000).default('Generated report') })
  .strict();

export function createDemoReportRoute({
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
  return router;
}
