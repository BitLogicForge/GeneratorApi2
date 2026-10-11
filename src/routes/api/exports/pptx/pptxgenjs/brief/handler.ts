import { sendDownload } from '@/http/download';

import { inputSchema, readInput } from './schema.ts';

import type { RequestHandler } from 'express';
import type { RouteDependencies } from '@/http/types';

export default function createHandler({
  presentations,
  queues,
}: RouteDependencies): RequestHandler<Record<string, string>> {
  return async (req, res) => {
    const input = inputSchema.parse(readInput(req));
    await sendDownload(
      res,
      queues.presentations,
      () => presentations.generate('brief', input),
      input.filename,
      'pptx',
    );
  };
}
