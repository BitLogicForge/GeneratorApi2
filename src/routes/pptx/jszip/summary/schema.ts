import { decodeExportInput } from '@/http/input';
import { pptxRenderSchema } from '@/services/jszip/contracts';

import type { Request } from 'express';

// Public fields accepted by this route; defaults and constraints come from the renderer.
export const requestSchema = pptxRenderSchema
  .pick({
    filename: true,
    replacements: true,
  })
  .strict();

export function readRequestInput(req: Request) {
  return decodeExportInput(req, ['replacements']);
}
