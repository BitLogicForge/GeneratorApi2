import { z } from 'zod';

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
      !/[\u0000-\u001f#]/.test(value),
    'Use a relative route without fragments',
  );
export const documentIdSchema = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[A-Za-z0-9_-]+$/);
export const pdfUrlQuerySchema = z.record(
  z.string().max(100),
  z.string().max(2000),
);

export function resolvePdfRoute(pattern: string, id: string) {
  return pattern.replaceAll('{id}', encodeURIComponent(id));
}
