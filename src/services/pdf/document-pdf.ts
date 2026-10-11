import { AppError } from '@/errors';
import { pdfRoutePatternSchema, resolvePdfRoute } from '@/pdf-route';
import { pdfSchema } from '@/schemas';

import type { Config } from '@/config';

/** Resolves document defaults without mutating caller query values. */
export function createDocumentPdfResolver(
  config: Pick<Config, 'pdfRoutePattern' | 'defaultLanguage'>,
) {
  const routePattern = pdfRoutePatternSchema.parse(config.pdfRoutePattern);
  return (
    id: string,
    queryValues: Record<string, string>,
    landscape?: boolean,
  ) => {
    const query = { ...queryValues };
    const route = resolvePdfRoute(routePattern, id);
    const target = new URL(route, 'http://webapp.invalid');
    for (const key of target.searchParams.keys()) {
      if (Object.hasOwn(query, key))
        throw new AppError(
          400,
          'RESERVED_QUERY_PARAMETER',
          `Query parameter is configured by the server: ${key}`,
        );
    }
    if (
      !target.searchParams.has('language') &&
      !Object.hasOwn(query, 'language')
    )
      query.language = config.defaultLanguage;
    return pdfSchema.parse({
      route,
      query,
      filename: id,
      ...(landscape !== undefined && { landscape }),
    });
  };
}
