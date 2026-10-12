# Development and verification

[Back to overview](../README.md)

## Configuration: where to edit

| Change                                                                 | File                                              |
| ---------------------------------------------------------------------- | ------------------------------------------------- |
| Shared PDF appearance and Data API cache defaults                      | `src/config/defaults.ts`                          |
| Environment validation and limits                                      | `src/config/environment.ts`                       |
| Document URL pattern and default language                              | `src/reports/document/settings.ts`                |
| A report's inputs, page, filename, print overrides, or service factory | Its `report.ts`                                   |
| Renderer validation contracts                                          | `src/services/{pdf,jszip,pptxgenjs}/contracts.ts` |

`src/config.ts` keeps the public `loadConfig` imports stable. `src/config/index.ts` assembles validated settings. Neither file needs changes when adding a report. Secrets and deployment hosts remain environment variables.

## Add a PDF endpoint

Create `src/routes/api/exports/pdf/sales/report.ts`:

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
  }),
  print: {
    landscape: false,
    margin: { top: 8 },
  },
});
```

Add `get.ts` and, if POST is needed, `post.ts`. Both contain:

```ts
export { default } from './report.ts';
```

This exposes `GET/POST /api/exports/pdf/sales`. GET uses flat URL parameters; POST uses the same fields in a JSON object. The helper decodes transport, rejects duplicate parameters, validates requests and renderer input, and uses the shared PDF queue/download handling. HEAD validates input and returns attachment metadata without rendering.

Report `print` overrides merge with shared defaults, including individual margin sides. They affect only that report's requests. The public request accepts only its schema's fields; print overrides in the definition are server-owned. Use `jsonFields` when specific GET fields contain JSON, or `readRequestInput` for path parameters or a custom transport shape. Keep unknown fields rejected with `.strict()`.

The existing quarterly report is a complete example at `src/routes/api/exports/pdf/portrait/quarterly/report.ts`. The portrait and landscape document routes share `src/reports/document/report.ts` instead of duplicating validation and URL resolution.

## Add a placeholder PowerPoint endpoint

Place `sales.pptx` in `templates/`, using text placeholders such as `{{title}}`. Create `src/routes/api/exports/pptx/jszip/sales/report.ts`:

```ts
import { definePptxReport } from '@/reports/pptx';
import { templateReport } from '@/reports/template';

export const report = templateReport('sales');
export default definePptxReport(report);
```

Add the same `get.ts`/`post.ts` re-exports as above. This registers the trusted template path locally and accepts the existing `filename`/`replacements` contract. For a differently named source file, use `templateReport('sales', 'sales-template.pptx')`. No service class, startup edit, or dependency-interface edit is needed. See the business and summary report folders for working examples.

## Add a custom PowerPoint service

Create your service beside the report or in `src/services/`. It must return a `Buffer` from `generate(input)`. Define its schema and factory in the report module:

```ts
import { z } from 'zod';

import { definePptxReport } from '@/reports/pptx';

import { SalesReportService } from './service.ts';

export const report = {
  schema: z.object({ id: z.string().min(1).max(80) }).strict(),
  filename: (input: { id: string }) => `sales-${input.id}`,
  createService: ({ dataApi }) => new SalesReportService(dataApi),
} satisfies import('@/reports/pptx').PptxReport<{ id: string }>;

export default definePptxReport(report);
```

The example assumes you implement `SalesReportService` with that constructor and input. The factory receives validated application configuration and the shared typed Data API client. It runs once per report per application, including when GET and POST share the definition. Keep business logic in the service.

Optional `validate()` runs during startup and contributes to readiness; use it to validate source presentations. Optional `close()` runs after active HTTP requests drain. Every owned service is offered cleanup even when another cleanup fails. Injected test services are externally managed.

The DAA report demonstrates adapting an existing service to a route-specific input. The brief report demonstrates a generated design. A new generated design can construct `PowerPointGenerationService` with its own trusted design registry inside `createService`; a different input structure can use its own service without changing central contracts.

## Test, document, and deploy

1. Add HTTP tests under `test/http/` covering downloads, defaults, invalid/unknown/duplicate parameters, errors, and HEAD. Cover both methods when exposing GET and POST.
2. Verify PDF forwarding/appearance or relevant PPTX ZIP/XML content. For chart changes, check the embedded workbook and editability too.
3. Update `docs/endpoints.md` and add an output example when useful.
4. Run `npm run lint`, `npm test`, and `npm run build`. Run `npm run test:outputs` when document appearance changes.
5. Restart after adding/moving method files. GitLab compiles `dist/` before ACR packages the image; template `.pptx` files are included automatically.

For report tests, use the generic service container rather than adding a property to `AppOptions`:

```ts
const reports = createReportServices();
reports.override(report, { generate: async () => Buffer.from('test output') });
const app = createApp({ reports, pdf: fakePdf });
await reports.initialize();
```

Import `createReportServices` from `@/reports/services` and `report` from the report module. The PDF service remains directly injectable. Existing `presentations`, `templatePresentations`, and `templateReportDemo` injections remain supported for compatibility. New reports should use `reports.override`. A test can pass discovered routes as the second argument to `createApp` to exercise a new report in isolation.

Adding a report requires its definition, method re-exports, optional service/template, tests, and documentation. It requires no changes to `index.ts`, global configuration, or a central dependency interface.

## Pre-commit checks

`npm ci` installs Husky's local Git hook. Before each commit, `lint-staged` formats supported staged files with Prettier and updates those files in the commit. It preserves unstaged edits, including partially staged files. Then Oxlint, TypeScript, and Knip check the working tree; a failed check blocks the commit. The hook does not run document rendering tests.

Run `npm run precommit` manually to perform the same actions, or `npm run prepare` to reinstall the hook. CI, production installs, and folders without Git metadata skip hook installation. Full formatting checks remain available through `npm run lint`; only staged files are autoformatted by the hook.

## Verification and production build

Distant source imports use `@/` for `src/`, for example `import { loadConfig } from '@/config'`. Tests can use `@examples/` for example workflows. Aliases omit file extensions and work in `tsx` through TypeScript path mappings; `scripts/rewrite-imports.mjs` rewrites them to relative `.js` imports during normal and Azure builds.

Local TypeScript imports use `.ts` extensions. `rewriteRelativeImportExtensions` rewrites them to `.js` in compiled output. `npm run typecheck` also runs `npm run check:imports`, which rejects relative `.js` imports in TypeScript files. JavaScript build outputs and actual `.mjs` tooling scripts retain their extensions.

Run `npm run lint` to check code correctness and promise handling with Oxlint, TypeScript types, unused code and dependencies with Knip, and formatting with Prettier. Use `npm run lint:code` to run only the code-pattern checks. These commands do not modify files. Oxlint uses TypeScript-aware rules compatible with the project's TypeScript 7 compiler; its configuration lives in `.oxlintrc.json`. Node test registrations are exempt from floating-promise warnings because the test runner tracks their completion; other promises in tests remain checked.

Use `npm run deps:check` to preview dependency updates within the declared version ranges. Use `npm run deps:update` to apply them with npm-check-updates doctor mode, which checks types, Knip, and tests to identify failing upgrades. Commit or stash existing changes first; PDF tests require Chromium (`npm run browser:install`).

Run `npm run knip` to find unused files, exports, and dependencies. Knip analyzes source code, tests, examples, and build scripts; its configuration lives in `knip.json`. The GitLab build runs this check before packaging the app.

For Linux Azure App Service, use the root Dockerfile with your prebuilt Node.js/Chromium image. GitLab compiles the API and passes `dist/` as an artifact to the ACR build job. The image includes compiled code, production dependencies, and templates; `npm run smoke:container` verifies readiness and real document downloads during the image build. See [Azure deployment](azure.md) for settings and the legacy ZIP packaging option.

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
