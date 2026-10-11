import { z } from 'zod';

import { AppError } from '@/errors';
import { sendDownload } from '@/http/download';
import { documentedRoute } from '@/http/openapi/route';
import { documentTextSchema } from '@/validation/document-text';

import type { RequestHandler } from 'express';
import type { RouteDependencies } from '@/http/types';

const demoQuerySchema = z
  .object({ TEXT_ME: documentTextSchema.max(5000).default('Generated report') })
  .strict();

function createHandler({
  templateReportDemo,
  queues,
}: RouteDependencies): RequestHandler {
  return async (req, res) => {
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
  };
}

export default documentedRoute(createHandler, {
  summary: 'Generate random table and chart data',
  tag: 'PowerPoint',
  query: demoQuerySchema,
  format: 'pptx',
  example: { TEXT_ME: 'Generated report' },
});
