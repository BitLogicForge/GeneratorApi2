import { AppError } from '@/errors';
import { sendDownload } from '@/http/download';

import { readRequestInput, requestSchema } from './schema.ts';

import type { RequestHandler } from 'express';
import type { RouteDependencies } from '@/http/types';

export default function createHandler({
  templateReportDemo,
  queues,
}: RouteDependencies): RequestHandler {
  return async (req, res) => {
    const input = requestSchema.parse(readRequestInput(req));
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
