import type { Response } from 'express';

const contentTypes = {
  pdf: 'application/pdf',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};

export async function sendDownload(
  res: Response,
  generate: () => Promise<Buffer>,
  filename: string,
  format: keyof typeof contentTypes,
) {
  const buffer = await generate();
  res
    .attachment(`${filename}.${format}`)
    .type(contentTypes[format])
    .send(buffer);
}
