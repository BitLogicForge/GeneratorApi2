import { AppError } from '@/errors';
import { sendDownload } from '@/http/download';
import { generationInput } from '@/http/input';
import { templatePresentationSchema } from '@/schemas';

import type { RequestHandler } from 'express';
import type { RouteDependencies } from '@/http/types';

export default function createHandler({
  templatePresentations,
  templateCatalog,
  queues,
}: RouteDependencies): RequestHandler<Record<string, string>> {
  return async (req, res) => {
    const input = templatePresentationSchema.parse(generationInput(req));
    if (
      !templatePresentations ||
      (templateCatalog &&
        !templateCatalog.some((entry) => entry.id === 'summary'))
    )
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
