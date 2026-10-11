import type { Response } from 'express';
import type { GenerationQueue } from '@/queue/generation-queue';

const contentTypes = {
  pdf: 'application/pdf',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};

/** Queues generation, cancels waiting jobs on disconnect, and sends a download. */
export async function sendDownload(
  res: Response,
  queue: GenerationQueue,
  generate: () => Promise<Buffer>,
  filename: string,
  format: keyof typeof contentTypes,
) {
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
  res
    .set('Cache-Control', 'no-store')
    .attachment(`${filename}.${format}`)
    .type(contentTypes[format])
    .send(buffer);
}
