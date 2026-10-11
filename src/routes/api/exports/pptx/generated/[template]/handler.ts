import type { RequestHandler } from 'express';
import type { RouteDependencies } from '@/http/types';
import { generationInput } from '@/http/input';
import { sendDownload } from '@/http/download';
import { presentationSchema } from '@/schemas';

export default function createHandler({
  presentations,
  queues,
}: RouteDependencies): RequestHandler<Record<string, string>> {
  return async (req, res) => {
    const input = presentationSchema.parse(generationInput(req));
    await sendDownload(
      res,
      queues.presentations,
      () => presentations.generate(req.params.template, input),
      input.filename,
      'pptx',
    );
  };
}
