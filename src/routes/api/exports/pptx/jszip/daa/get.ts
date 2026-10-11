import { AppError } from '@/errors';
import { sendDownload } from '@/http/download';
import { demoQuerySchema } from '@/templates/catalog';

import type { RequestHandler } from 'express';
import type { RouteDependencies } from '@/http/types';

export default function createHandler({
  templateReportDemo,
  templateCatalog,
  queues,
}: RouteDependencies): RequestHandler {
  return async (req, res) => {
    const input = demoQuerySchema.parse(req.query);
    if (
      !templateReportDemo ||
      (templateCatalog && !templateCatalog.some((entry) => entry.id === 'daa'))
    )
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
