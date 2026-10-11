import { decodeExportInput } from '@/http/input';
import { presentationSchema } from '@/schemas';

import type { Request } from 'express';

// Explicit fields accepted by this endpoint; validation rules come from the shared contract.
export const inputSchema = presentationSchema.pick({
  filename: true,
  title: true,
  subtitle: true,
  author: true,
  accent: true,
  slides: true,
});

/** Reads GET/HEAD query parameters or POST JSON for this endpoint only. */
export function readInput(req: Request) {
  return decodeExportInput(req, ['slides']);
}
