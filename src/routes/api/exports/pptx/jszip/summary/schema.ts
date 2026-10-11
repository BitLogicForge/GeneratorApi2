import { decodeExportInput } from '@/http/input';

import { pptxRenderSchema } from '../schema.ts';

import type { Request } from 'express';

// API request fields for this template export; no webapp query is used.
export const requestSchema = pptxRenderSchema.pick({
  filename: true,
  replacements: true,
});

/** Reads GET/HEAD query parameters or POST JSON for this endpoint only. */
export function readRequestInput(req: Request) {
  return decodeExportInput(req, ['replacements']);
}
