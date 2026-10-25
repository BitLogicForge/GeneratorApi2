# Development Guide

[Back to Documentation Index](../README.md)

## Where to Configure

| Setting                                            | Location                                       |
| -------------------------------------------------- | ---------------------------------------------- |
| Shared PDF print defaults & Data API cache budget  | `src/config/defaults.ts`                       |
| Environment variables & process limits             | `src/config/schema.ts`, `src/config/index.ts`  |
| Route request validation & GET/POST decoding       | `src/routes/<format>/<name>/schema.ts`         |
| Route input mapping, filename, print/service setup | `src/routes/<format>/<name>/report.ts`         |
| Public Express path & HTTP method registration     | `src/routes/router.ts`                         |
| Renderer input contracts                           | `src/services/{pdf,jszip,pptxgenjs}/schema.ts` |

## 1. Add a PDF Endpoint

Create `src/routes/pdf/<name>/schema.ts` and `src/routes/pdf/<name>/report.ts`:

```ts
import { z } from 'zod';

import { definePdfReport } from '@/reports/pdf';

const requestSchema = z
  .object({
    year: z
      .string()
      .regex(/^\d{4}$/)
      .default('2026'),
    language: z.enum(['en', 'de', 'pl']).default('en'),
  })
  .strict();

export default definePdfReport({
  schema: requestSchema,
  prepareInput: (input) => ({
    route: '/reports/sales',
    query: input,
    filename: `sales-${input.year}-${input.language}`,
    waitForSelector: '[data-report-ready]',
    waitForNetworkIdle: true,
  }),
  print: {
    landscape: false,
    margin: { top: 8 },
  },
});
```

Register the factory in `src/routes/router.ts`:

```ts
import sales from './pdf/sales/report.ts';

const salesHandler = sales(dependencies);
router.get('/pdf/sales', salesHandler);
router.post('/pdf/sales', salesHandler);
```

### URL Placeholders & Query Renaming

- Use `params` in `prepareInput` for path placeholders expanded by `buildUrl`
  (`src/utils/url.ts`), e.g. `route: '/onepager/:id', params: { id }`.
- Use `mapQuery(query, externalQueryNames)` from `@/utils/url` when public query
  parameter names differ from upstream webapp query names (see
  `src/routes/pdf/onepager/schema.ts`).

## 2. Add a Placeholder PowerPoint Endpoint

Place `<name>.pptx` in `templates/` with `{{token}}` placeholders, then wire the
report with `templateService` from `@/reports/template`:

```ts
import { definePptxReport } from '@/reports/pptx';
import { templateService } from '@/reports/template';
import { pptxRenderSchema } from '@/services/jszip/schema';

import { readRequestInput, requestSchema } from './schema.ts';

import type { z } from 'zod';
import type { PptxReport } from '@/reports/pptx';
import type { PptxRenderInput } from '@/services/jszip/schema';

const report = {
  schema: requestSchema,
  readRequestInput,
  prepareInput: ({ filename, replacements }) => ({
    filename,
    input: pptxRenderSchema.parse({ filename, replacements }),
  }),
  ...templateService('sales', 'sales.pptx'),
} satisfies PptxReport<z.infer<typeof requestSchema>, PptxRenderInput>;

export default definePptxReport(report);
```

## 3. Add a Custom PowerPoint Service

Implement a service class with `generate(input): Promise<Buffer>` (and optional
startup `validate(): Promise<void>` / shutdown `close(): Promise<void>`), then
construct it in `createService: ({ config, dataApi }) => ...` inside `report.ts`
(see `src/routes/pptx/daa/report.ts` and `src/routes/pptx/tma/report.ts`).

## 4. Imports, Build & Static Checks

- Relative imports must include `.ts` extensions (`./schema.ts`).
- Distant imports use extensionless `@/` (for `src/`) or `@examples/` aliases.
- Static verification commands:
  - `npm run lint:code` — Oxlint type-aware linting
  - `npm run typecheck` — Import extension check + TypeScript compiler (`tsc`)
  - `npm run knip` — Unused files, exports, and dependencies
  - `npm run format:check` — Prettier formatting check
  - `npm run build` — Bundles `src/` into `dist/` via `esbuild`
