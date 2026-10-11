import { AppError } from '@/errors';
import { sendDownload } from '@/http/download';

import { inputSchema, readInput } from './schema.ts';

import type { RequestHandler } from 'express';
import type { RouteDependencies } from '@/http/types';

export default function createHandler({
  templatePresentations,
  queues,
}: RouteDependencies): RequestHandler<Record<string, string>> {
  return async (req, res) => {
    const input = inputSchema.parse(readInput(req));
    if (!templatePresentations)
      throw new AppError(
        404,
        'UNKNOWN_TEMPLATE',
        'PowerPoint file template not found',
      );
    await sendDownload(
      res,
      queues.presentations,
      () => templatePresentations.generate('summary', input),
      input.filename,
      'pptx',
    );
  };
}
