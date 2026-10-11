import { z } from 'zod';

import { contentTypes } from '../download.ts';
import { jsonQueryFields } from '../input.ts';

import type { FileRoute } from '../file-routes/types.ts';
import type { RouteDocumentation } from './route.ts';

type Schema = z.core.JSONSchema.JSONSchema;
type Parameter = {
  name: string;
  in: 'query' | 'path';
  required: boolean;
  description?: string;
  schema?: Schema;
  example?: unknown;
  content?: Record<string, { schema: Schema; example?: unknown }>;
};
type Response = {
  description: string;
  headers: Record<string, { description?: string; schema: Schema }>;
  content?: Record<string, { schema: Schema }>;
};
type Operation = {
  operationId: string;
  summary: string;
  description?: string;
  tags: string[];
  parameters: Parameter[];
  requestBody?: {
    required: boolean;
    content: Record<string, { schema: Schema; example?: unknown }>;
  };
  responses: Record<string, Response>;
};

const errorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z
      .array(
        z.object({
          path: z.array(z.union([z.string(), z.number()])),
          message: z.string(),
        }),
      )
      .optional(),
    requestId: z.string(),
  }),
});
const requestIdHeader = {
  'X-Request-Id': {
    description: 'Request correlation ID.',
    schema: { type: 'string' } as Schema,
  },
};
const errorDescriptions: Record<number, string> = {
  400: 'Invalid request parameters or malformed JSON.',
  404: 'Presentation template is unavailable.',
  413: 'JSON body exceeds 100 KB.',
  415: 'Unsupported body charset or content encoding.',
  500: 'Document generation failed.',
  502: 'Webapp returned an unsuccessful response.',
  503: 'Queue full, expired, or closed; retry after 5 seconds.',
  504: 'Rendering timed out.',
};

function parameters(
  schema: z.ZodObject | undefined,
  location: 'query' | 'path',
  example: RouteDocumentation['example'],
  encoded: boolean,
): Parameter[] {
  if (!schema) return [];
  const json = z.toJSONSchema(schema, { io: 'input' });
  return Object.entries(json.properties ?? {}).map(([name, property]) => {
    const field = property as Schema;
    const base = {
      name,
      in: location,
      required: location === 'path' || (json.required ?? []).includes(name),
      description: field.description,
    };
    if (encoded && jsonQueryFields.includes(name)) {
      return {
        ...base,
        content: {
          'application/json': { schema: field, example: example?.[name] },
        },
      };
    }
    return { ...base, schema: field, example: example?.[name] };
  });
}

/** Uses discovered paths/methods and native Zod input conversion; never invokes handlers. */
export function createOpenApiDocument(routes: FileRoute[]) {
  const paths: Record<
    string,
    Partial<Record<FileRoute['method'], Operation>>
  > = {};
  for (const route of routes) {
    const docs = route.factory.documentation;
    if (!docs)
      throw new Error(
        `Missing API documentation: ${route.method.toUpperCase()} ${route.path}`,
      );
    const path = route.path.replace(/:([A-Za-z_][A-Za-z0-9_]*)/g, '{$1}');
    const methods =
      route.method === 'get' &&
      !routes.some(
        (other) => other.method === 'head' && other.path === route.path,
      )
        ? (['get', 'head'] as const)
        : [route.method];
    for (const method of methods) {
      const headers = {
        ...requestIdHeader,
        ...(docs.format || docs.noStore
          ? {
              'Cache-Control': {
                schema: { type: 'string', const: 'no-store' } as Schema,
              },
            }
          : {}),
        ...(docs.format
          ? {
              'Content-Disposition': {
                description: 'Attachment filename.',
                schema: { type: 'string' } as Schema,
              },
            }
          : {}),
      };
      const mediaType = docs.format
        ? contentTypes[docs.format]
        : 'application/json';
      const success: Response = {
        description: docs.format
          ? 'Generated file attachment.'
          : 'Successful response.',
        headers,
      };
      if (method !== 'head')
        success.content = {
          [mediaType]: {
            schema: docs.format
              ? {}
              : z.toJSONSchema(docs.response ?? z.unknown()),
          },
        };
      const responses: Record<string, Response> = { 200: success };
      if (docs.format) {
        const statuses = [
          400,
          500,
          503,
          ...(docs.format === 'pdf' ? [502, 504] : [404]),
          ...(method === 'post' ? [413, 415] : []),
        ];
        for (const status of statuses) {
          responses[status] = {
            description: errorDescriptions[status],
            headers: {
              ...requestIdHeader,
              ...(status === 503
                ? {
                    'Retry-After': {
                      schema: { type: 'string', const: '5' } as Schema,
                    },
                  }
                : {}),
            },
            ...(method !== 'head'
              ? {
                  content: {
                    'application/json': {
                      schema: { $ref: '#/components/schemas/Error' },
                    },
                  },
                }
              : {}),
          };
        }
      }
      for (const [status, response] of Object.entries(docs.responses ?? {})) {
        responses[status] = {
          description: response.description,
          headers,
          ...(method !== 'head'
            ? {
                content: {
                  'application/json': {
                    schema: z.toJSONSchema(response.schema),
                  },
                },
              }
            : {}),
        };
      }
      const operation: Operation = {
        operationId: `${method}_${path.replace(/[^A-Za-z0-9]+/g, '_')}`,
        summary:
          method === 'head' ? `${docs.summary} (headers only)` : docs.summary,
        description: docs.description,
        tags: [docs.tag],
        parameters: [
          ...parameters(docs.params, 'path', undefined, false),
          ...parameters(
            docs.query ??
              (method === 'get' || method === 'head' ? docs.input : undefined),
            'query',
            docs.example,
            !!docs.input,
          ),
        ],
        responses,
      };
      if (method === 'post' && docs.input)
        operation.requestBody = {
          required: true,
          content: {
            'application/json': {
              schema: z.toJSONSchema(docs.input, { io: 'input' }),
              example: docs.example,
            },
          },
        };
      (paths[path] ??= {})[method] = operation;
    }
  }
  return {
    openapi: '3.1.0',
    info: {
      title: 'Generator API',
      version: '1.0.0',
      description:
        'PDF and editable PowerPoint generation. GET structured query fields use JSON encoding. HEAD validates input and returns headers without generating documents.',
    },
    servers: [{ url: '/' }],
    paths,
    components: { schemas: { Error: z.toJSONSchema(errorSchema) } },
  };
}
