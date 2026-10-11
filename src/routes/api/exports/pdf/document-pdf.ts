import { AppError } from '@/errors';
import { pdfRoutePatternSchema, resolvePdfRoute } from '@/pdf-route';
import { pdfSchema } from '@/schemas/pdf';

import type { Config } from '@/config';
import type { DocumentPdfRequest } from '@/schemas/document-pdf';

/** Resolves document defaults without mutating caller query values. */
export function createDocumentPdfResolver(
  config: Pick<Config, 'pdfRoutePattern' | 'defaultLanguage'>,
  landscape: boolean,
) {
  // Validate the configured route once when the endpoint is registered.
  const routePattern = pdfRoutePatternSchema.parse(config.pdfRoutePattern);
  return ({ id, query: queryValues }: DocumentPdfRequest) => {
    // Copy request values so adding defaults does not mutate the caller input.
    const query = { ...queryValues };
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
    return pdfSchema.parse({
      route,
      query,
      filename: id,
      landscape,
    });
  };
}
