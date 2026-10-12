import { AppError } from '@/errors';
import { pdfRenderSchema } from '@/services/pdf/contracts';

import type { PdfRenderInput } from '@/services/pdf/contracts';

type QueryValue = PdfRenderInput['query'][string];

/** Maps validated public parameters to webapp names, omitting absent values. */
export function mapPdfRoute<
  Input extends Record<string, QueryValue | undefined>,
>(
  externalRoute: string,
  parameters: Input,
  mapping: Partial<Record<keyof Input, string>>,
  defaults: Record<string, QueryValue> = {},
): Pick<PdfRenderInput, 'route' | 'query'> {
  const route = pdfRenderSchema.shape.route.parse(externalRoute);
  const target = new URL(route, 'http://webapp.invalid');
  const query: PdfRenderInput['query'] = {};
  for (const [inputName, externalName] of Object.entries(mapping)) {
    const value = parameters[inputName];
    if (externalName === undefined || value === undefined) continue;
    if (target.searchParams.has(externalName))
      throw new AppError(
        400,
        'RESERVED_QUERY_PARAMETER',
        `Query parameter is configured by the server: ${externalName}`,
      );
    Object.defineProperty(query, externalName, {
      value,
      enumerable: true,
      configurable: true,
      writable: true,
    });
  }
  for (const [name, value] of Object.entries(defaults)) {
    if (!target.searchParams.has(name) && !Object.hasOwn(query, name))
      Object.defineProperty(query, name, {
        value,
        enumerable: true,
        configurable: true,
        writable: true,
      });
  }
  return { route, query };
}
