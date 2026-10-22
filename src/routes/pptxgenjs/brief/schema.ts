import { decodeExportInput } from '@/http/input';
import { briefInputSchema } from '@/services/pptxgenjs/schema';

import type { Request } from 'express';

// Route-owned public fields; reusable renderer constraints stay in the service contract.
export const requestSchema = briefInputSchema
  .pick({
    filename: true,
    title: true,
    subtitle: true,
    author: true,
    accent: true,
    slides: true,
  })
  .strict();

export function readRequestInput(req: Request) {
  return decodeExportInput(req, ['slides']);
}
