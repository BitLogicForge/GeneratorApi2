import { sendDownload } from '@/http/download';
import { generationInput } from '@/http/input';
import { pdfSchema } from '@/schemas';

import type { RequestHandler } from 'express';
import type { RouteDependencies } from '@/http/types';

export default function createHandler({
  pdf,
  azureCredential,
  queues,
}: RouteDependencies): RequestHandler<Record<string, string>> {
  return async (req, res) => {
    const input = pdfSchema.parse(generationInput(req));
    await sendDownload(
      res,
      queues.pdf,
      () =>
        pdf.generate(input, {
          user: res.locals.user,
          ...(azureCredential ? { azureCredential } : {}),
        }),
      input.filename,
      'pdf',
    );
  };
}
