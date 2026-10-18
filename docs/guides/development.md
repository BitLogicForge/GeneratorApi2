# Development and verification

[Back to overview](../../README.md)

## Configuration: where to edit

| Change                                                                 | File                                           |
| ---------------------------------------------------------------------- | ---------------------------------------------- |
| Shared PDF appearance and Data API cache defaults                      | `src/config/defaults.ts`                       |
| Environment validation and limits                                      | `src/config/environment.ts`                    |
| Document URL pattern and default language                              | Each PDF route folder's `report.ts`            |
| A report's inputs, page, filename, print overrides, or service factory | Its `report.ts`                                |
| Renderer validation contracts                                          | `src/services/{pdf,jszip,pptxgenjs}/schema.ts` |

`src/config.ts` keeps the public `loadConfig` imports stable. `src/config/index.ts` assembles validated settings. Neither file needs changes when adding a report. Secrets and deployment hosts remain environment variables.

## Add a PDF endpoint

Create `src/routes/pdf/sales/report.ts`:

```ts
import { z } from 'zod';

import { definePdfReport } from '@/reports/pdf';

export default definePdfReport({
  schema: z
    .object({
      year: z
        .string()
        .regex(/^\\d{4}$/)
        .default('2026'),
      language: z.enum(['en', 'de', 'pl']).default('en'),
    })
    .strict(),
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

Import the factory in `src/routes/router.ts` and register it explicitly:

```ts
import sales from './pdf/sales/report.ts';

// Inside createRouter:
const salesHandler = sales(dependencies);
router.get('/pdf/sales', salesHandler);
router.post('/pdf/sales', salesHandler);
```

This exposes `GET/POST /pdf/sales`. GET uses flat URL parameters; POST uses the same fields in a JSON object. The helper decodes transport, rejects duplicate parameters, validates requests and renderer input, and uses the shared PDF queue/download handling. HEAD validates input and returns attachment metadata without rendering.

Report `print` overrides merge with shared defaults, including individual margin sides. They affect only that report's requests. The public request accepts only its schema's fields; print overrides in the definition are server-owned. Use `jsonFields` when specific GET fields contain JSON, or `readRequestInput` for path parameters or a custom transport shape. Keep unknown fields rejected with `.strict()`.

The quarterly report is a complete example at `src/routes/pdf/quarterly/`, with validation in `schema.ts` and webapp mapping in `report.ts`. Factsheet and onepager use `src/routes/pdf/factsheet/` and `src/routes/pdf/onepager/`, each with `schema.ts` and `report.ts`. Their public paths, `/pdf/factsheet/:id` and `/pdf/onepager/:id`, are registered in `src/routes/router.ts`; handlers read the ID from `req.params.id`. Folder names do not define URL parameters. External page patterns, supported query parameters, defaults, and parameter mapping stay beside the report.

## Add a placeholder PowerPoint endpoint

Each PPTX route folder owns its public contract, target, mapping, and output filename:

- `schema.ts` declares allowed fields, validation, defaults, and GET/POST decoding.
- `report.ts` selects the trusted template or generated design, maps validated fields in `prepareInput`, and configures its service.
- `src/routes/router.ts` registers the report factory with Express methods and explicit URL paths.

Place `sales.pptx` in `templates/`, using placeholders such as `{{title}}`.
Create `src/routes/pptx/jszip/sales/schema.ts`:

```ts
import { decodeExportInput } from '@/http/input';
import { pptxRenderSchema } from '@/services/jszip/schema';

import type { Request } from 'express';

export const requestSchema = pptxRenderSchema
  .pick({
    filename: true,
    replacements: true,
  })
  .strict();

export function readRequestInput(req: Request) {
  return decodeExportInput(req, ['replacements']);
}
```

Then create `report.ts`:

```ts
import { definePptxReport } from '@/reports/pptx';
import { templateService } from '@/reports/template';
import { pptxRenderSchema } from '@/services/jszip/schema';

import { readRequestInput, requestSchema } from './schema.ts';

import type { z } from 'zod';
import type { PptxReport } from '@/reports/pptx';
import type { PptxRenderInput } from '@/services/jszip/schema';

const template = 'sales';
const sourceFile = 'sales.pptx';

export const report = {
  schema: requestSchema,
  readRequestInput,
  notConfiguredMessage: 'PowerPoint file template not found',
  prepareInput: ({ filename, replacements }) => ({
    filename,
    input: pptxRenderSchema.parse({ filename, replacements }),
  }),
  ...templateService(template, sourceFile),
} satisfies PptxReport<z.infer<typeof requestSchema>, PptxRenderInput>;

export default definePptxReport(report);
```

Import the default factory into `src/routes/router.ts`, create its handler with
`const salesHandler = sales(dependencies)`, and register it with
`router.get('/pptx/jszip/sales', salesHandler)` and
`router.post('/pptx/jszip/sales', salesHandler)`. HEAD validates without generating.
`templateService` handles only trusted template loading, generation, and lifecycle.
It does not choose the public schema, parameter mapping, or output filename.
The route owns those choices. Registering the route also registers its service before startup initialization.
See DAA and TMA for working examples.

## Add a custom PowerPoint service

Create your service beside the report or in `src/services/`. It must return a `Buffer` from `generate(input)`. Define its public schema in `schema.ts` and its target, mapping, and factory in `report.ts`:

```ts
import { definePptxReport } from '@/reports/pptx';

import { requestSchema } from './schema.ts';
import { SalesReportService } from './service.ts';

export const report = {
  schema: requestSchema,
  prepareInput: ({ id }: { id: string }) => ({
    filename: `sales-${id}`,
    input: { id },
  }),
  createService: ({ dataApi }) => new SalesReportService(dataApi),
} satisfies import('@/reports/pptx').PptxReport<{ id: string }>;

export default definePptxReport(report);
```

The example assumes `schema.ts` validates `{ id: string }` and you implement `SalesReportService` with that constructor and input. The factory receives validated application configuration and the shared typed Data API client. It runs once per report per application, including when GET and POST share the definition. Keep business logic in the service.

Optional `validate()` runs during startup and contributes to readiness; use it to validate source presentations. Optional `close()` runs after active HTTP requests drain. Every owned service is offered cleanup even when another cleanup fails. Injected test services are externally managed.

The DAA report maps the public `TEXT_ME` field to the string consumed by its service in `prepareInput`. The brief report demonstrates a generated design. A new generated design can construct `PowerPointGenerationService` with its own trusted design registry inside `createService`; a different input structure can use its own service without changing central contracts.

## Test, document, and deploy

For agent tasks, follow the [verification policy in AGENTS.md](../../AGENTS.md#verification): use static checks by default and add or run tests only when explicitly requested. Existing tests and CI verification remain in place.

1. When tests are requested, add or run relevant HTTP tests under `test/http/` covering downloads, defaults, invalid/unknown/duplicate parameters, errors, and HEAD. Cover both methods when exposing GET and POST.
2. When document verification is requested, inspect PDF forwarding/appearance or relevant PPTX ZIP/XML content. For chart changes, check the embedded workbook and editability too.
3. Update `docs/guides/endpoints.md` and add an output example when useful.
4. For TypeScript changes, run `npm run typecheck`, `npm run lint:code`, and `npm run knip`; check formatting of changed files. Run `npm run build` when compilation, import rewriting, or execution from `dist/` changes. Use `npm test` only when the requested verification requires the full suite.
5. Restart after changing route registrations. GitLab compiles `dist/` before packaging the ZIP; template `.pptx` files are included automatically.

For report tests, use the generic service container rather than adding a property to `AppOptions`:

```ts
const reports = createReportServices();
reports.override(report, { generate: async () => Buffer.from('test output') });
const app = createApp({ reports, pdf: fakePdf });
await reports.initialize();
```

Import `createReportServices` from `@/reports/services` and `report` from the report module. The PDF service remains directly injectable. Override PowerPoint report services using `reports.override(report, fakeService)`. A test can pass a router factory as the second argument to `createApp`, for example `(dependencies) => Router().get('/report', factory(dependencies))`, to exercise a report in isolation. Import `Router` from `express`.

Adding a report requires its definition, explicit registration in `src/routes/router.ts`, optional service/template, and documentation; add tests when requested. It requires no changes to `index.ts`, global configuration, or a central dependency interface.

## Manual checks

Run `npm run format` to format files and `npm run lint` for code lint, type checking, Knip, and formatting checks. These commands are explicit; installing dependencies and committing do not run Git hooks.

## Verification and production build

Distant source imports use `@/` for `src/`, for example `import { loadConfig } from '@/config'`. Tests can use `@examples/` for example workflows. Aliases omit file extensions and work in `tsx` through TypeScript path mappings; `esbuild` resolves them during the production build.

Local TypeScript imports use `.ts` extensions. `npm run typecheck` also runs `npm run check:imports`, which rejects relative `.js` imports in TypeScript files. Production builds use `esbuild` (`npm run build`) to bundle source modules into `dist/` with code splitting, leaving `tsc` strictly for type checking (`npm run typecheck`). JavaScript build outputs and actual `.mjs` tooling scripts retain their extensions.

Run `npm run lint` to check code correctness and promise handling with Oxlint, TypeScript types, unused code and dependencies with Knip, and formatting with Prettier. Use `npm run lint:code` to run only the code-pattern checks. These commands do not modify files. Oxlint uses TypeScript-aware rules compatible with the project's TypeScript 7 compiler; its configuration lives in `.oxlintrc.json`. Node test registrations are exempt from floating-promise warnings because the test runner tracks their completion; other promises in tests remain checked.

Use `npm run deps:check` to preview dependency updates within the declared version ranges. Use `npm run deps:update` to apply them with npm-check-updates doctor mode, which checks types, Knip, and tests to identify failing upgrades. Commit or stash existing changes first; PDF tests require Chromium (`npm run browser:install`).

Run `npm run knip` to find unused files, exports, and dependencies. Knip analyzes source code, tests, examples, and build scripts; its configuration lives in `knip.json`. The GitLab build runs this check before packaging the app.

For Linux Azure App Service, GitLab compiles the API (`npm run build`), packages the ZIP with production dependencies, and deploys it with `az webapp deploy`. See [Azure deployment](azure.md) for configuration and settings.

Format all supported project files with `npm run format`. Use `npm run format:check` to check formatting without modifying files. Dependencies, builds, generated output, and PowerPoint template files are excluded.

```bash
npm run typecheck
npm test
npm run build
npm start
```

Tests exercise actual Chromium PDF output, query forwarding, timeouts, capacity limits, upstream errors, API validation, and editable PowerPoint XML including speaker notes. `npm start` runs compiled files from `dist`.

A 200-request burst can be admitted with the default limits, but jobs run in batches and may time out while waiting. This is admission control, not a guarantee of throughput. Queues are local to each process and are lost on restart; multiple Azure instances have independent queues. Load-test real documents on your chosen Azure plan. For long waits or durable jobs, use an external queue with job-status endpoints and Blob Storage downloads.

This POC is intended for trusted webapps and internal use. Navigation is restricted to the configured origin, but the webapp may fetch external assets and data. Add authentication, request rate limits, network egress controls, and a durable job queue before exposing it publicly or accepting untrusted webapps. Health checks report process availability, not browser readiness. Authenticated report pages need an explicit server-managed authentication strategy.

The `image-size` dependency is overridden to patched version 2.0.3 because PptxGenJS currently requests an older vulnerable range. The included template uses text and shapes; verify image behavior when introducing image templates.

Library references: [Playwright page API](https://playwright.dev/docs/api/class-page#page-pdf), [PptxGenJS saving presentations](https://gitbrent.github.io/PptxGenJS/docs/usage-saving/).

### Map PDF parameters to an external page

Return the page pattern, named path parameters, and validated query values directly
from `prepareInput` when query names already match the webapp:

```ts
prepareInput: ({ id, query }) => ({
  route: '/onepager/:id',
  params: { id },
  query,
  filename: id,
}),
```

The renderer uses `buildUrl` from `src/url.ts` to build the full URL on the
configured origin. Path placeholders use Express syntax such as `:id` and are expanded and encoded
by `path-to-regexp`. Supply `params` for path templates; plain routes need no
`params`. Put dynamic query values in `query`, where Node’s native `URLSearchParams`
handles encoding. Undefined query values are omitted. Missing required values in
`params` are configuration errors.
For example:

```ts
buildUrl('https://webapp.example', '/onepager/:id', {
  params: { id: 'id2222' },
  query: { START: '2027-01-01', BENCHMARK: 'REPORTING' },
});
```

Onepager keeps an `externalQueryNames` dictionary in
`src/routes/pdf/onepager/schema.ts`. Keys are public query names; values are the
names sent to the external webapp:

```ts
const externalQueryNames = {
  START: 'START',
  END: 'END',
  BENCHMARK: 'BENCHMARK',
} satisfies Record<keyof z.infer<typeof querySchema>, string>;
```

Change a value, such as `START: 'from'`, to rename an outgoing field while keeping
the public API unchanged. The request schema validates the public fields first,
then calls the shared `mapQuery` helper from `src/url.ts` to rename fields and omit absent values. TypeScript requires the dictionary to
cover every declared query field. `report.ts` passes this mapped query to the
shared URL builder. Defaults can stay in the public field schemas.

PDF report orientation is defined only in `print.landscape` on the report
definition. `prepareInput` returns the external route, query, filename, and
readiness options; it cannot return `landscape` or `print`. Both TypeScript and
runtime validation enforce this rule. Omitted orientation uses shared print defaults.
