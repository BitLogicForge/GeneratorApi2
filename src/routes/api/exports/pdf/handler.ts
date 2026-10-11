import { sendDownload } from '@/http/download';
import { generationInput } from '@/http/input';
import { documentedRoute } from '@/http/openapi/route';
import { pdfSchema } from '@/schemas';

import type { RequestHandler } from 'express';
import type { RouteDependencies } from '@/http/types';

function createHandler({
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

export default documentedRoute(createHandler, {
  summary: 'Generate a webapp PDF',
  tag: 'PDF',
  input: pdfSchema,
  format: 'pdf',
  example: {
    route: '/reports/quarterly',
    query: { year: 2026, quarter: 3 },
    landscape: false,
  },
});
