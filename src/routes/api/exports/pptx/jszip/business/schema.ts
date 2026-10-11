import { decodeExportInput } from '@/http/input';
import { templatePresentationSchema } from '@/schemas';

import type { Request } from 'express';

// Explicit fields accepted by this endpoint; validation rules come from the shared contract.
export const inputSchema = templatePresentationSchema.pick({
  filename: true,
  replacements: true,
});

/** Reads GET/HEAD query parameters or POST JSON for this endpoint only. */
export function readInput(req: Request) {
  return decodeExportInput(req, ['replacements']);
}
