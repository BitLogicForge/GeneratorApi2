import { decodeExportInput } from '@/http/input';

import { pdfSchema } from '../schema.ts';

import type { Request } from 'express';

// Explicit fields accepted by this endpoint; validation rules come from the shared contract.
export const inputSchema = pdfSchema.pick({
  route: true,
  query: true,
  filename: true,
  waitForSelector: true,
  format: true,
  landscape: true,
});

/** Reads GET/HEAD query parameters or POST JSON for this endpoint only. */
export function readInput(req: Request) {
  return decodeExportInput(req, ['query', 'landscape']);
}
