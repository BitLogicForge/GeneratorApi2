import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { z } from 'zod';

import { templatePresentationSchema } from '@/schemas';
import { DaaPocPresentationService } from '@/services/jszip/daa-poc-presentation-service';
import { documentTextSchema } from '@/validation/document-text';

import { inspectTemplate } from './inspect.ts';

const definitionSchema = z
  .object({
    id: z.string().regex(/^[a-z][a-z0-9-]*$/),
    version: z.string().min(1),
    description: z.string().min(1),
    file: z.string().regex(/^[A-Za-z0-9_-]+\.pptx$/),
    mode: z.enum(['placeholders', 'daa-demo']),
    requiredPlaceholders: z
      .array(z.string().regex(/^[A-Za-z][A-Za-z0-9_]{0,63}$/))
      .default([]),
    requiredObjects: z
      .array(
        z
          .object({
            name: z.string().min(1),
            kind: z.enum(['text', 'table', 'chart']),
            rows: z.number().int().positive().optional(),
            columns: z.number().int().positive().optional(),
            series: z.number().int().positive().optional(),
          })
          .strict(),
      )
      .default([]),
  })
  .strict();

export type TemplateDefinition = z.infer<typeof definitionSchema>;

export const demoQuerySchema = z
  .object({
    TEXT_ME: documentTextSchema.max(5000).default('Generated report'),
  })
  .strict();

/** Loads only trusted local registrations. Inspection is read-only and precedes startup. */
export async function loadTemplateCatalog(
  directory = new URL('../../templates/', import.meta.url),
) {
  const definitions = z
    .array(definitionSchema)
    .min(1)
    .parse(
      JSON.parse(await readFile(new URL('catalog.json', directory), 'utf8')),
    );
  const ids = new Set<string>();
  const entries = [];
  for (const definition of definitions) {
    if (ids.has(definition.id))
      throw new Error(`Duplicate template ID: ${definition.id}`);
    ids.add(definition.id);
    if ((definition.id === 'daa') !== (definition.mode === 'daa-demo'))
      throw new Error('Template daa must use the daa-demo workflow');
    if (
      definition.mode === 'daa-demo' &&
      !['TAB100', 'GGO', 'TEXT_ME'].every((name) =>
        definition.requiredObjects.some((object) => object.name === name),
      )
    )
      throw new Error(
        'The daa-demo workflow requires TAB100, GGO, and TEXT_ME',
      );
    const path = fileURLToPath(new URL(definition.file, directory));
    const inspection = await inspectTemplate(path, definition).catch(
      (error: unknown) => {
        throw new Error(
          `${definition.id}: ${error instanceof Error ? error.message : String(error)}`,
          { cause: error },
        );
      },
    );
    if (definition.mode === 'daa-demo')
      await new DaaPocPresentationService(path, () => 0).generate();
    const schema =
      definition.mode === 'placeholders'
        ? templatePresentationSchema.extend({
            replacements: z
              .object(
                Object.fromEntries(
                  inspection.placeholders.map((name) => [
                    name,
                    documentTextSchema.max(5000),
                  ]),
                ),
              )
              .strict(),
          })
        : demoQuerySchema;
    entries.push({
      definition,
      path,
      metadata: {
        id: definition.id,
        version: definition.version,
        description: definition.description,
        endpoint: `/api/exports/pptx/jszip/${definition.id}`,
        methods:
          definition.mode === 'placeholders'
            ? ['GET', 'HEAD', 'POST']
            : ['GET', 'HEAD'],
        features:
          definition.mode === 'placeholders'
            ? ['slide-text', 'speaker-note-text']
            : [
                'named-text',
                'editable-tables',
                'category-charts',
                'embedded-workbooks',
              ],
        requiredPlaceholders: definition.requiredPlaceholders,
        requiredObjects: definition.requiredObjects,
        requestSchema: z.toJSONSchema(schema, { io: 'input' }),
        textConstraints:
          'Text must contain only XML 1.0 characters; replacement values are limited to 5,000 characters.',
        ...inspection,
      },
    });
  }
  return entries;
}

export type TemplateCatalog = Awaited<ReturnType<typeof loadTemplateCatalog>>;
