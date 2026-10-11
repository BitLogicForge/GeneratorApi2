import { AppError } from '@/errors';
import { pdfRoutePatternSchema, resolvePdfRoute } from '@/pdf-route';

import { pdfSchema } from '../../schema.ts';

import type { z } from 'zod';
import type { Config } from '@/config';
import type { documentPdfRequestSchema } from './schema.ts';

/** Resolves this endpoint's document parameters and print settings. */
export function createDocumentPdfResolver(
  config: Pick<Config, 'pdfRoutePattern' | 'defaultLanguage'>,
) {
  // Validate the configured route once when the endpoint is registered.
  const routePattern = pdfRoutePatternSchema.parse(config.pdfRoutePattern);
  return ({
    id,
    query: queryValues,
  }: z.infer<typeof documentPdfRequestSchema>) => {
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
    // Apply shared PDF defaults while keeping the endpoint-selected orientation.
    // No readiness selector is configured: wait only for page load and fonts.
    return pdfSchema.parse({
      route,
      query,
      filename: id,
      landscape: true,
    });
  };
}
