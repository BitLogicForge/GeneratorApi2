import { z } from 'zod';

import { AppError } from '@/errors';
import {
  pdfRoutePatternSchema,
  resolvePdfRoute,
} from '@/services/pdf/contracts';
import { documentIdSchema } from '@/validation/document-id';

import { definePdfReport } from '../pdf.ts';

import type { RouteFactory } from '@/http/file-routes/types';

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
const requestSchema = z
  .object({
    id: documentIdSchema,
    query: webappQuerySchema,
  })
  .strict();

/** Shares document validation and target resolution across both orientations. */
export function defineDocumentPdfReport(print: {
  landscape: boolean;
}): RouteFactory {
  return (dependencies) => {
    const routePattern = pdfRoutePatternSchema.parse(
      dependencies.config.pdfRoutePattern,
    );
    return definePdfReport({
      schema: requestSchema,
      readRequestInput: (req) => ({ id: req.params.id, query: req.query }),
      prepareInput: ({ id, query: queryValues }, config) => {
        // Forward only the explicitly supported, validated webapp parameters.
        const query: { language?: string; year?: string } = {};
        if (queryValues.language !== undefined)
          query.language = queryValues.language;
        if (queryValues.year !== undefined) query.year = queryValues.year;
        const route = resolvePdfRoute(routePattern, id);
        // The placeholder origin only lets us inspect query keys in a relative route.
        const target = new URL(route, 'http://webapp.invalid');
        // Query values fixed by the configured pattern take precedence over caller values.
        for (const key of target.searchParams.keys()) {
          if (Object.hasOwn(query, key))
            throw new AppError(
              400,
              'RESERVED_QUERY_PARAMETER',
              `Query parameter is configured by the server: ${key}`,
            );
        }
        // Use the default language only when neither the route nor the caller sets it.
        if (
          !target.searchParams.has('language') &&
          !Object.hasOwn(query, 'language')
        )
          query.language = config.defaultLanguage;
        return { route, query, filename: id, landscape: print.landscape };
      },
    })(dependencies);
  };
}
