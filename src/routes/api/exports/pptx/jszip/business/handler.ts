import { AppError } from '@/errors';
import { sendDownload } from '@/http/download';
import { generationInput } from '@/http/input';
import { documentedRoute } from '@/http/openapi/route';
import { templatePresentationSchema } from '@/schemas';

import type { RequestHandler } from 'express';
import type { RouteDependencies } from '@/http/types';

function createHandler({
  templatePresentations,
  queues,
}: RouteDependencies): RequestHandler<Record<string, string>> {
  return async (req, res) => {
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
      () => templatePresentations.generate('business', input),
      input.filename,
      'pptx',
    );
  };
}

export default documentedRoute(createHandler, {
  summary: 'Fill the business template',
  tag: 'PowerPoint',
  input: templatePresentationSchema,
  format: 'pptx',
  description: 'Requires title, subtitle, and customer replacements.',
  example: {
    replacements: {
      title: 'Quarterly review',
      subtitle: 'Results and outlook',
      customer: 'Acme',
    },
  },
});
