import { z } from 'zod';

import { documentIdSchema } from '@/validation/document-id';

import type { Request } from 'express';

// Only these parameters are forwarded to the webapp document page.
const webappQuerySchema = z
  .object({
    language: z.string().trim().min(1).max(100).optional(),
    year: z
      .string()
      .regex(/^\d{4}$/)
      .refine((value) => Number(value) >= 2000 && Number(value) <= 2100)
      .optional(),
  })
  .strict();

// API request: document ID from the path and webapp parameters from the URL.
export const requestSchema = z
  .object({
    id: documentIdSchema,
    query: webappQuerySchema,
  })
  .strict();

export type RequestInput = z.infer<typeof requestSchema>;

export function readRequestInput(req: Request<Record<string, string>>) {
  return { id: req.params.id, query: req.query };
}
