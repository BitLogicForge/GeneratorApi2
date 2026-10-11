import { z } from 'zod';

import { hasControlCharacters } from '@/validation/control-characters';

// Supports both path parameters (/documents/{id}) and query parameters (/document?id={id}).
export const pdfRoutePatternSchema = z
  .string()
  .max(2000)
  .startsWith('/')
  .refine(
    (value) => value.includes('{id}'),
    'pdfRoutePattern must contain {id}',
  )
  .refine(
    (value) =>
      !value.startsWith('//') &&
      !value.includes('\\') &&
      !value.includes('#') &&
      !hasControlCharacters(value),
    'Use a relative route without fragments',
  );
export function resolvePdfRoute(pattern: string, id: string) {
  return pattern.replaceAll('{id}', encodeURIComponent(id));
}
