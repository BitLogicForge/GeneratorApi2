import {
  CacheControlValue,
  ContentType,
  HttpHeader,
  HttpMethod,
} from './constants.ts';

import type { Response } from 'express';
import type { GenerationQueue } from '@/queue/generation-queue';
import type { ExportFormat } from './constants.ts';

/** Sends HEAD metadata without rendering; queues GET/POST downloads and cancels disconnected waits. */
export async function sendDownload(
  res: Response,
  queue: GenerationQueue,
  generate: () => Promise<Buffer>,
  filename: string,
  format: ExportFormat,
) {
  const setDownloadHeaders = () =>
    res
      .set(HttpHeader.CacheControl, CacheControlValue.NoStore)
      .attachment(`${filename}.${format}`)
      .type(ContentType[format]);
  if (res.req.method === HttpMethod.Head) {
    setDownloadHeaders().end();
    return;
  }
  const controller = new AbortController();
  const queuedAt = performance.now();
  const onClose = () => {
    if (!res.writableFinished) controller.abort();
  };
  res.once('close', onClose);
  let buffer: Buffer;
  try {
    buffer = await queue.run(async () => {
      res.locals.queueWaitMs = performance.now() - queuedAt;
      const started = performance.now();
      try {
        return await generate();
      } finally {
        res.locals.generationMs = performance.now() - started;
      }
    }, controller.signal);
  } finally {
    res.locals.queueWaitMs ??= performance.now() - queuedAt;
    res.off('close', onClose);
  }
  if (res.destroyed) return;
  res.locals.outputBytes = buffer.length;
  setDownloadHeaders().send(buffer);
}
