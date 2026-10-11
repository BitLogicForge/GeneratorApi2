import { sendDownload } from '@/http/download';
import { generationInput } from '@/http/input';
import { documentedRoute } from '@/http/openapi/route';
import { presentationSchema } from '@/schemas';

import type { RequestHandler } from 'express';
import type { RouteDependencies } from '@/http/types';

function createHandler({
  presentations,
  queues,
}: RouteDependencies): RequestHandler<Record<string, string>> {
  return async (req, res) => {
    const input = presentationSchema.parse(generationInput(req));
    await sendDownload(
      res,
      queues.presentations,
      () => presentations.generate('brief', input),
      input.filename,
      'pptx',
    );
  };
}

export default documentedRoute(createHandler, {
  summary: 'Generate a brief presentation',
  tag: 'PowerPoint',
  input: presentationSchema,
  format: 'pptx',
  example: {
    title: 'Quarterly review',
    slides: [{ title: 'Results', bullets: ['Delivered 12 projects'] }],
  },
});
