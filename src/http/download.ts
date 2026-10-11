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
  const onClose = () => {
    if (!res.writableFinished) controller.abort();
  };
  res.once('close', onClose);
  let buffer: Buffer;
  try {
    buffer = await queue.run(generate, controller.signal);
  } finally {
    res.off('close', onClose);
  }
  if (res.destroyed) return;
  setDownloadHeaders().send(buffer);
}
