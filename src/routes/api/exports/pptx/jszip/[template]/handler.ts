import { AppError } from '@/errors';
import { sendDownload } from '@/http/download';
import { generationInput } from '@/http/input';
import { templatePresentationSchema } from '@/schemas';

import type { RequestHandler } from 'express';
import type { RouteDependencies } from '@/http/types';

export default function createHandler({
  templateCatalog = [],
  templatePresentations,
  queues,
}: RouteDependencies): RequestHandler<{ template: string }> {
  return async (req, res) => {
    const template = templateCatalog.find(
      (entry) =>
        entry.id === req.params.template &&
        entry.features.includes('slide-text'),
    );
    if (!template || !templatePresentations)
      throw new AppError(404, 'NOT_FOUND', 'Endpoint not found');
    const input = templatePresentationSchema.parse(generationInput(req));
    await sendDownload(
      res,
      queues.presentations,
      () => templatePresentations.generate(template.id, input),
      input.filename,
      'pptx',
    );
  };
}
