import type { Response } from 'express';
import type { GenerationQueue } from '@/queue/generation-queue';

const contentTypes = {
  pdf: 'application/pdf',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};

/** Sends HEAD metadata without rendering; queues GET/POST downloads and cancels disconnected waits. */
export async function sendDownload(
  res: Response,
  queue: GenerationQueue,
  generate: () => Promise<Buffer>,
  filename: string,
  format: keyof typeof contentTypes,
) {
  const setDownloadHeaders = () =>
    res
      .set('Cache-Control', 'no-store')
      .attachment(`${filename}.${format}`)
      .type(contentTypes[format]);
  if (res.req.method === 'HEAD') {
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
