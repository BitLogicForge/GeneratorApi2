import { z } from 'zod';

import { AppError } from '@/errors';
import { sendDownload } from '@/http/download';
import { documentTextSchema } from '@/validation/document-text';

import type { RequestHandler } from 'express';
import type { RouteDependencies } from '@/http/types';

const demoQuerySchema = z
  .object({ TEXT_ME: documentTextSchema.max(5000).default('Generated report') })
  .strict();

export default function createHandler({
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
      () =>
        templateReportDemo.generate(input.TEXT_ME, { user: res.locals.user }),
      'demo-report',
      'pptx',
    );
  };
}
