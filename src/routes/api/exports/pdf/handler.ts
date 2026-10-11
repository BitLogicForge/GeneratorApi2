import type { RequestHandler } from 'express';
import type { RouteDependencies } from '@/http/types';
import { generationInput } from '@/http/input';
import { sendDownload } from '@/http/download';
import { pdfSchema } from '@/schemas';

export default function createHandler({
  pdf,
  queues,
}: RouteDependencies): RequestHandler<Record<string, string>> {
  return async (req, res) => {
    const input = pdfSchema.parse(generationInput(req));
    await sendDownload(
      res,
      queues.pdf,
      () => pdf.generate(input),
      input.filename,
      'pdf',
    );
  };
}
