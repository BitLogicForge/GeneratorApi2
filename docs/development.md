# Development and verification

[Back to overview](../README.md)

## Add a new endpoint: step-by-step

The example below adds `GET /sales-report.pptx?title=Quarterly%20sales`. It reuses the current report-demo template so you can start with a working download, then replace the service's data generation with your own API calls. These are instructions for adding a future endpoint; `/sales-report.pptx` is not registered yet.

### 1. Define the request schema

Create `src/routes/sales-report.pptx/schema.ts`:

```ts
import { z } from 'zod';

import type { Request } from 'express';

export const requestSchema = z
  .object({ title: z.string().min(1).max(5000).default('Sales report') })
  .strict();

export type RequestInput = z.infer<typeof requestSchema>;

export function readRequestInput(req: Request) {
  return req.query;
}
```

Give optional parameters defaults so the URL also works without a query string. `.strict()` rejects misspelled or unknown parameters. Keep application defaults in `src/config.ts`; use environment settings for hosts, credentials, and runtime limits.

### 2. Add the generation service

Create `src/services/jszip/sales-report-service.ts`:

```ts
import { DaaPocPresentationService } from '@/services/jszip/daa-poc-presentation-service';

import type { RequestInput as SalesReportInput } from '@/routes/sales-report.pptx/schema';

export class SalesReportService {
  private readonly template: DaaPocPresentationService;

  constructor(templatePath: string) {
    this.template = new DaaPocPresentationService(templatePath);
  }

  generate(input: SalesReportInput): Promise<Buffer> {
    return this.template.generate(input.title);
  }
}
```

This starting implementation puts `title` into `TEXT_ME` and uses the existing random table/chart data. For your real report, fetch data with `DataApiClient` and use the `src/pptx/jszip` helpers to populate named objects. Keep Express requests and responses out of the service; return the finished file as a `Buffer`.

### 3. Declare the dependency

In `src/http/types.ts`, import `RequestInput as SalesReportInput` from
`@/routes/sales-report.pptx/schema`, then add this property inside `AppOptions`:

```ts
salesReport?: { generate(input: SalesReportInput): Promise<Buffer> };
```

`RouteDependencies` inherits it automatically. Making the dependency optional lets unrelated route tests continue using their existing fixtures; the route below returns 404 when it is not configured.

### 4. Wire the service at startup

Import the service in `src/index.ts`:

```ts
import { SalesReportService } from '@/services/jszip/sales-report-service';
```

Add this property to the existing `createApp({ ... })` call:

```ts
salesReport: new SalesReportService(
  fileURLToPath(new URL('../templates/daa.pptx', import.meta.url)),
),
```

For a different template, place its `.pptx` in the root `templates/` directory and use that path. The Azure build includes those files. Match its object names and chart/table structure to your service.

### 5. Add the route file

Create `src/routes/sales-report.pptx/get.ts`. The folder defines `/sales-report.pptx`
and the filename defines GET; the loader registers it automatically:

```ts
import { AppError } from '@/errors';
import { sendDownload } from '@/http/download';

import { readRequestInput, requestSchema } from './schema.ts';

import type { RequestHandler } from 'express';
import type { RouteDependencies } from '@/http/types';

export default function createHandler({
  salesReport,
  queues,
}: RouteDependencies): RequestHandler {
  return async (req, res) => {
    const input = requestSchema.parse(readRequestInput(req));
    if (!salesReport) {
      throw new AppError(
        404,
        'REPORT_NOT_CONFIGURED',
        'Sales report not configured',
      );
    }
    await sendDownload(
      res,
      queues.presentations,
      () => salesReport.generate(input),
      'sales-report',
      'pptx',
    );
  };
}
```

The download helper handles queuing, disconnected clients, filename extensions,
content type, and attachment headers. Use `queues.pdf` and format `'pdf'` for PDF
files, or validate input and call `res.json(data)` for JSON endpoints.

For GET and POST sharing an operation, put the factory in `handler.ts` and create
`get.ts` and `post.ts` that each contain `export { default } from './handler.ts';`.
Define the endpoint's `requestSchema` and `readRequestInput(req)` in its local `schema.ts`.
The reader calls `decodeExportInput(req, ['slides'])` (with that endpoint's own
JSON field list) before validation. This helper reads POST bodies directly and
decodes only the named GET/HEAD fields; it has no global parameter registry.
Keep accepted fields and transport decoding next to the route.

There is no manual route registration in `src/app.ts`. See
[src/routes/README.md](../src/routes/README.md) for folder conventions. Restart the
server after adding or moving route files; production changes need a fresh build.

### 6. Test and document it

Add a `test/http/sales-report.test.ts` using `createApp` and Supertest, following `test/pptx/jszip/daa-poc-presentation-service.test.ts`. Cover a successful download, the default title, a custom title, invalid parameters, and generation failures. Check that the PPTX contains the supplied text, rather than only checking HTTP 200.

Add a file-producing case to `test/integration/output-routes.ts`: configure `salesReport` in its `createApp` fixture and call `save('/sales-report.pptx?title=Sales%20demo', 'sales-report.pptx', 'Sales demo')` inside a subtest. Add the endpoint, accepted parameters, and a request example to `docs/endpoints.md`.

### 7. Verify and rebuild

```bash
npm run format
npm run typecheck
npm test
npm run test:outputs
npm run build
```

Start the API, then download the new report:

```bash
curl --fail-with-body 'http://localhost:3000/sales-report.pptx?title=Quarterly%20sales' \
  --output sales-report.pptx
```

For Azure, rebuild and test the deployment package after adding the endpoint:

```bash
npm run build:azure
npm run test:azure
```

## Pre-commit checks

`npm ci` installs Husky's local Git hook. Before each commit, `lint-staged` formats supported staged files with Prettier and updates those files in the commit. It preserves unstaged edits, including partially staged files. Then Oxlint, TypeScript, and Knip check the working tree; a failed check blocks the commit. The hook does not run document rendering tests.

Run `npm run precommit` manually to perform the same actions, or `npm run prepare` to reinstall the hook. CI, production installs, and folders without Git metadata skip hook installation. Full formatting checks remain available through `npm run lint`; only staged files are autoformatted by the hook.

## Verification and production build

Distant source imports use `@/` for `src/`, for example `import { loadConfig } from '@/config'`. Tests can use `@examples/` for example workflows. Aliases omit file extensions and work in `tsx` through TypeScript path mappings; `scripts/rewrite-imports.mjs` rewrites them to relative `.js` imports during normal and Azure builds.

Local TypeScript imports use `.ts` extensions. `rewriteRelativeImportExtensions` rewrites them to `.js` in compiled output. `npm run typecheck` also runs `npm run check:imports`, which rejects relative `.js` imports in TypeScript files. JavaScript build outputs and actual `.mjs` tooling scripts retain their extensions.

Run `npm run lint` to check code correctness and promise handling with Oxlint, TypeScript types, unused code and dependencies with Knip, and formatting with Prettier. Use `npm run lint:code` to run only the code-pattern checks. These commands do not modify files. Oxlint uses TypeScript-aware rules compatible with the project's TypeScript 7 compiler; its configuration lives in `.oxlintrc.json`. Node test registrations are exempt from floating-promise warnings because the test runner tracks their completion; other promises in tests remain checked.

Use `npm run deps:check` to preview dependency updates within the declared version ranges. Use `npm run deps:update` to apply them with npm-check-updates doctor mode, which checks types, Knip, and tests to identify failing upgrades. Commit or stash existing changes first; PDF tests require Chromium (`npm run browser:install`).

Run `npm run knip` to find unused files, exports, and dependencies. Knip analyzes source code, tests, examples, and build scripts; its configuration lives in `knip.json`. The GitLab build runs this check before packaging the app.

For Linux Azure App Service, run `npm run build:azure` to create `output/azure/generator-api.zip`, then `npm run test:azure` to smoke-test the package. See [Azure deployment](azure.md) for startup and deployment settings.

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
