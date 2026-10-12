import { z } from 'zod';

import { pdfPrintSettings } from '@/config/defaults';
import { hasControlCharacters } from '@/validation/control-characters';
import { filenameSchema } from '@/validation/filename';

const pdfPrintSettingsSchema = z
  .object({
    format: z.enum([
      'A3',
      'A4',
      'A5',
      'A6',
      'Letter',
      'Legal',
      'Tabloid',
      'Ledger',
    ]),
    landscape: z.boolean(),
    margin: z
      .object({
        top: z.number().min(0).max(200),
        right: z.number().min(0).max(200),
        bottom: z.number().min(0).max(200),
        left: z.number().min(0).max(200),
      })
      .strict(),
    scale: z.number().min(0.1).max(2),
    printBackground: z.boolean(),
    printImages: z.boolean(),
    media: z.enum(['print', 'screen']),
    preferCSSPageSize: z.boolean(),
    displayHeaderFooter: z.boolean(),
    headerTemplate: z.string().max(20000),
    footerTemplate: z.string().max(20000),
    hideSelectors: z.array(z.string().trim().min(1).max(300)).max(100),
    css: z.string().max(50000),
  })
  .strict();

export function resolvePdfPrintSettings(
  settings: PdfPrintSettings = pdfPrintSettings,
  overrides: PdfPrintOverrides = {},
) {
  return pdfPrintSettingsSchema.parse({
    ...settings,
    ...overrides,
    margin: { ...settings.margin, ...overrides.margin },
  });
}

export type PdfPrintSettings = z.infer<typeof pdfPrintSettingsSchema>;
export const pdfPrintOverridesSchema = pdfPrintSettingsSchema.partial().extend({
  margin: pdfPrintSettingsSchema.shape.margin.partial().optional(),
});
export type PdfPrintOverrides = z.infer<typeof pdfPrintOverridesSchema>;

// Supports path parameters (/factsheet/{id}) and query parameters (/document?id={id}).
export const pdfRoutePatternSchema = z
  .string()
  .max(2000)
  .startsWith('/')
  .refine((value) => value.includes('{id}'), 'Route pattern must contain {id}')
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

/** Trusted report-owned origin; this is never decoded from request parameters. */
export const pdfOriginSchema = z
  .url()
  .refine((value) => {
    const url = new URL(value);
    return (
      ['http:', 'https:'].includes(url.protocol) &&
      !url.username &&
      !url.password &&
      url.pathname === '/' &&
      !url.search &&
      !url.hash
    );
  }, 'Use an HTTP(S) origin without credentials, path, query, or fragment')
  .transform((value) => new URL(value).origin);

/** Shared PDF renderer contract, used by every PDF endpoint. */
export const pdfRenderSchema = z
  .object({
    route: z
      .string()
      .min(1)
      .max(2000)
      .startsWith('/')
      .refine(
        (v) =>
          !v.startsWith('//') && !v.includes('\\') && !hasControlCharacters(v),
        'Use a relative webapp route',
      ),
    // Internal transport values; each route validates its own allowed parameter names.
    query: z
      .record(
        z.string().max(100),
        z.union([z.string().max(2000), z.number(), z.boolean()]),
      )
      .default({}),
    filename: filenameSchema.default('document'),
    waitForSelector: z.string().min(1).max(300).optional(),
    format: z
      .enum(['A3', 'A4', 'A5', 'A6', 'Letter', 'Legal', 'Tabloid', 'Ledger'])
      .default(() => resolvePdfPrintSettings().format),
    landscape: z.boolean().default(() => resolvePdfPrintSettings().landscape),
    print: pdfPrintOverridesSchema.optional(),
  })
  .strict();

export type PdfRenderInput = z.infer<typeof pdfRenderSchema>;
