import { z } from 'zod';
const filename = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-zA-Z0-9_-]+$/);
export const pdfSchema = z
  .object({
    route: z
      .string()
      .min(1)
      .max(2000)
      .startsWith('/')
      .refine(
        (v) =>
          !v.startsWith('//') &&
          !v.includes('\\') &&
          !/[\u0000-\u001f]/.test(v),
        'Use a relative webapp route',
      ),
    query: z
      .record(
        z.string().max(100),
        z.union([z.string().max(2000), z.number().finite(), z.boolean()]),
      )
      .default({}),
    filename: filename.default('document'),
    waitForSelector: z.string().min(1).max(300).optional(),
    format: z.enum(['A4', 'Letter']).default('A4'),
    landscape: z.boolean().default(false),
  })
  .strict();
export const presentationSchema = z
  .object({
    filename: filename.default('presentation'),
    title: z.string().min(1).max(100),
    subtitle: z.string().max(180).default(''),
    author: z.string().max(100).default('Generator API'),
    accent: z
      .string()
      .regex(/^[0-9a-fA-F]{6}$/)
      .default('2563EB'),
    slides: z
      .array(
        z
          .object({
            title: z.string().min(1).max(100),
            bullets: z.array(z.string().min(1).max(220)).min(1).max(6),
            notes: z.string().max(3000).optional(),
          })
          .strict(),
      )
      .min(1)
      .max(30),
  })
  .strict();

export type PdfInput = z.infer<typeof pdfSchema>;
export type PresentationInput = z.infer<typeof presentationSchema>;

export const templatePresentationSchema = z
  .object({
    filename: filename.default('presentation'),
    replacements: z
      .record(
        z.string().regex(/^[A-Za-z][A-Za-z0-9_]{0,63}$/),
        z.string().max(5000),
      )
      .refine(
        (value) =>
          Object.keys(value).length > 0 && Object.keys(value).length <= 100,
        'Supply 1–100 replacements',
      ),
  })
  .strict();
export type TemplatePresentationInput = z.infer<
  typeof templatePresentationSchema
>;
