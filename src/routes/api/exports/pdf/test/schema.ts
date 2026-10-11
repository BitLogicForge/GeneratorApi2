import { z } from 'zod';

import { decodeExportInput } from '@/http/input';

import { pdfRenderSchema } from '../schema.ts';

import type { Request } from 'express';

// Webapp parameters accepted only by this test endpoint.
const webappQuerySchema = z
  .object({
    language: z.string().trim().min(1).max(100).optional(),
    year: z
      .union([
        z.number().int().min(2000).max(2100),
        z
          .string()
          .regex(/^\d{4}$/)
          .refine((value) => Number(value) >= 2000 && Number(value) <= 2100),
      ])
      .optional(),
    quarter: z
      .union([z.number().int().min(1).max(4), z.enum(['1', '2', '3', '4'])])
      .optional(),
    print: z.boolean().optional(),
  })
  .strict()
  .default({});

// API request: technical PDF options plus the validated webapp query.
export const requestSchema = pdfRenderSchema
  .pick({
    route: true,
    filename: true,
    waitForSelector: true,
    format: true,
    landscape: true,
  })
  .extend({ query: webappQuerySchema });

/** Reads GET/HEAD query parameters or POST JSON for this endpoint only. */
export function readRequestInput(req: Request) {
  return decodeExportInput(req, ['query', 'landscape']);
}
