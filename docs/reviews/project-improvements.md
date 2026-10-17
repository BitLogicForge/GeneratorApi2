# Project Review: Architecture, Structure, Refactoring, and Simplicity

Reviewed on 2026-10-17 against branch `main` at commit `b31c1426`. Application code was evaluated across startup, configuration, routing, HTTP handling, report services, Chromium rendering, PowerPoint generation, upstream Data API integration, validation, tests, and CI/CD configuration.

---

## Executive Summary

Generator API provides a solid foundation for internal PDF printing via Chromium and editable PowerPoint generation via JSZip and PptxGenJS. Core strengths include FIFO request queueing with concurrency bounds, isolated browser contexts, atomic XML chart/workbook updates, and strict input validation.

However, the codebase currently suffers from friction across four key dimensions:

1. **Test Coverage Regression (Critical)**: In commit `b31c1426`, the entire `test/http/` directory (718 lines of HTTP integration tests across 4 files) was deleted rather than updating five stale import paths. Consequently, HTTP routing, request decoding, error handling, HEAD semantics, and download headers currently have **zero regression test coverage**.
2. **Project Structure & Micro-File Fragmentation**: An 11-endpoint application is managed by an over-engineered dynamic file-based router (5 modules in `src/http/file-routes/` plus top-level await disk traversal in `src/app.ts`), with routes split into 3–4 tiny files per endpoint. In addition, deep directory nesting (e.g. 6 micro-files in `src/pptx/jszip/charts/workbook/`) creates avoidable cognitive overhead.
3. **What Could Be Simpler (Over-Engineering & Dead Code)**:
   - Two competing service-injection systems coexist in `AppOptions` (legacy callback hooks vs. the `ReportServices` container).
   - Entire architectural subsystems are unused: `templateService`, `PowerPointTemplateService`, `pptxRenderSchema`, orphan template `templates/Tmp2.pptx`, and the entire `src/data-api/` client/cache layer (all active PPTX routes generate random numbers instead of calling the Data API).
   - Redundant schema parsing and destructuring boilerplate exists in routes (e.g., identity re-parsing in `brief`).
4. **Code Quality & Operational Hazards**:
   - The factsheet route rejects its documented `language` and `year` query parameters, leaving `defaultLanguage` unused and failing code lint.
   - Internal filesystem paths and parser errors are leaked to clients in `TemplateSource` error responses.
   - A Chromium disconnect places the service in a non-ready state without background recovery, risking deadlock under load balancers that withhold traffic from unready pods.
   - Shutdown enforces a hard 15-second process exit, terminating active renders that allow up to 30–120 seconds.
   - `test:azure` references a nonexistent test file, breaking `npm run test:azure`.

---

## Static Verification Baseline

Checks performed on 2026-10-17 using Node.js 24.15.0:

| Check                  | Result     | Root Cause / Details                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ---------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run typecheck`    | **Passed** | 0 errors. Passed only because deleted test files in commit `b31c1426` removed the five broken imports.                                                                                                                                                                                                                                                                                                                                                                                        |
| `npm run lint:code`    | **Failed** | Unused variable `defaultLanguage` in [src/routes/pdf/factsheet/[id]/report.ts:12](../../src/routes/pdf/factsheet/[id]/report.ts#L12).                                                                                                                                                                                                                                                                                                                                                         |
| `npm run knip`         | **Failed** | 5 unused exports: `templateService` in [src/reports/template.ts:16](../../src/reports/template.ts#L16), `pptxRenderSchema` in [src/services/jszip/contracts.ts:7](../../src/services/jszip/contracts.ts#L7), and `report` exports in [src/routes/pptx/daa/report.ts:12](../../src/routes/pptx/daa/report.ts#L12), [src/routes/pptx/tma/report.ts:12](../../src/routes/pptx/tma/report.ts#L12), and [src/routes/pptxgenjs/brief/report.ts:14](../../src/routes/pptxgenjs/brief/report.ts#L14). |
| `npm run format:check` | **Failed** | Code style issues in 4 files: `src/config.ts`, `src/routes/pdf/factsheet/[id]/report.ts`, `src/routes/pdf/factsheet/[id]/schema.ts`, `src/routes/pptx/tma/report.ts`.                                                                                                                                                                                                                                                                                                                         |
| `npm run build`        | **Passed** | Clean compilation to `dist/` with import rewriting.                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `npm run test:azure`   | **Failed** | `Could not find 'test/deployment/azure-package.ts'`.                                                                                                                                                                                                                                                                                                                                                                                                                                          |

---

## 1. Critical Deficiencies & Correctness

### C1. Complete loss of HTTP route test coverage

- **Location:** Commit `b31c1426` (`test/http/onet.test.ts`, `test/http/pdf-route-mapping.test.ts`, `test/http/pdf-routes.test.ts`, `test/http/pptx-routes.test.ts`).
- **Trigger:** Five imports were targeting obsolete route paths (`pdf/onet`, `pptx/jszip/business`, etc.). Instead of repairing the import paths and assertion URLs, commit `b31c1426` deleted all four test files (718 lines of test code).
- **Effect:**
  - Zero executable tests remain for Express routing, Zod request decoding, query parameter handling, HEAD metadata requests, download attachment headers, and HTTP error responses.
  - Knip flags `report` exports in `daa`, `tma`, and `brief` as unused because only those deleted test files imported them directly.
- **Actionable Fix:** Restore the HTTP route test suite under `test/http/`. Update endpoint URLs to match the active routing structure (`/pdf/example`, `/pdf/factsheet/:id`, `/pdf/onepager/:id`, `/pdf/quarterly`, `/pptx/daa`, `/pptx/tma`, `/pptxgenjs/brief`). Verify input decoding, validation errors, HEAD requests, and file downloads with injected mock services.

### C2. Factsheet parameter rejection and unused `defaultLanguage`

- **Location:** [src/routes/pdf/factsheet/[id]/report.ts:12](../../src/routes/pdf/factsheet/[id]/report.ts#L12), [src/routes/pdf/factsheet/[id]/schema.ts:6-8](../../src/routes/pdf/factsheet/[id]/schema.ts#L6-L8), [docs/guides/endpoints.md:61](../guides/endpoints.md#L61), [docs/services/pdf.md:37](../services/pdf.md#L37).
- **Trigger:** `docs/guides/endpoints.md` and `docs/services/pdf.md` document that `/pdf/factsheet/:id` accepts `language` (defaulting to `'en'`) and `year`. However, `querySchema` is defined as `z.object({}).strict()`, which rejects any query string with HTTP 400. In `report.ts`, `const defaultLanguage = 'en'` is declared but never referenced, causing `npm run lint:code` to fail.
- **Effect:** Sending the documented request `/pdf/factsheet/id2222?language=en` fails with a 400 `VALIDATION_ERROR`, while the codebase fails static linting.
- **Actionable Fix:** Either:
  1. Restore the schema in `schema.ts`:
     ```ts
     const querySchema = z
       .object({
         language: documentTextSchema.max(100).default(defaultLanguage),
         year: z
           .string()
           .regex(/^\d{4}$/)
           .optional(),
       })
       .strict();
     ```
     and pass `defaultLanguage` to `mapPdfRoute` or query parsing.
  2. Or, if query parameters are intentionally unsupported, remove `const defaultLanguage = 'en'` from `report.ts` and correct `docs/guides/endpoints.md` and `docs/services/pdf.md`.

### C3. Internal filesystem path disclosure in error responses

- **Location:** [src/services/jszip/template-source.ts:23](../../src/services/jszip/template-source.ts#L23), [src/http/error-handler.ts:53-70](../../src/http/error-handler.ts#L53-L70).
- **Trigger:** `TemplateSource` instantiates `AppError` with `message: 'Template "' + this.path + '": ' + message`, embedding the absolute local filesystem path and raw Node.js I/O or XML parser error. The centralized HTTP error handler directly echoes `error.message` for any `AppError` instance into the client JSON response.
- **Effect:** If a server template is missing or malformed, clients receive internal directory structures (e.g. `/workspaces/GeneratorApi/templates/daa.pptx`) and server diagnostic details.
- **Actionable Fix:** In `TemplateSource`, pass the detailed diagnostic message to `cause` for server logging, while using a generic public message in `AppError`:
  ```ts
  const failure = new AppError(
    error instanceof AppError ? error.status : 500,
    error instanceof AppError ? error.code : 'INVALID_TEMPLATE',
    'Configured presentation template is invalid or unavailable',
  );
  failure.cause = error;
  throw failure;
  ```

### C4. Endpoint naming discrepancies across code and documentation

- **Location:** [src/routes/pdf/example/report.ts:15](../../src/routes/pdf/example/report.ts#L15), [docs/guides/endpoints.md:201-210](../guides/endpoints.md#L201-L210), [docs/guides/endpoints.md:48](../guides/endpoints.md#L48).
- **Discrepancies:**
  - Route `/pdf/example` generates an attachment named `onet.pdf`. Meanwhile, `docs/guides/endpoints.md` documents `GET /pdf/onet` and references nonexistent `src/routes/pdf/onet/report.ts`.
  - `docs/guides/endpoints.md` lists `/pptx/jszip/daa` (404) and `/pptx/pptxgenjs/brief` (404), whereas the actual endpoints are `/pptx/daa` and `/pptxgenjs/brief`.
- **Actionable Fix:** Align code and docs: rename download filename in `src/routes/pdf/example/report.ts` to `example`, and update `docs/guides/endpoints.md` to reflect canonical URLs (`/pdf/example`, `/pptx/daa`, `/pptx/tma`, `/pptxgenjs/brief`).

---

## 2. Project Structure Improvements

### S1. Dynamic file-based routing introduces excessive ceremony for 11 endpoints

- **Location:** [src/http/file-routes/](../../src/http/file-routes/) (`discover.ts`, `register.ts`, `compare.ts`, `path.ts`, `types.ts`), [src/app.ts:22](../../src/app.ts#L22), [src/routes/](../../src/routes/).
- **The Problem:** The application uses Next.js-style file-based routing requiring 5 infrastructure files (173 lines of code) to scan directories, parse bracket syntax (`[id]`), sort static routes before parameter routes, and dynamically `import()` route modules.
  - At startup, `src/app.ts` executes top-level `await discoverRoutes(...)`, running asynchronous filesystem traversal upon module load.
  - Each endpoint is fragmented across a directory with 3 to 4 tiny files (`get.ts`, `post.ts`, `report.ts`, `schema.ts`). For example, `src/routes/pptx/daa/get.ts` contains only 2 lines: `export { default } from './report.ts';`.
  - There are currently only 11 HTTP route handlers across the entire application:
    - `GET /health`
    - `GET /internal/metrics`
    - `GET /internal/ready`
    - `GET /pdf/example`
    - `GET /pdf/factsheet/:id`
    - `GET /pdf/onepager/:id`
    - `GET /pdf/quarterly`
    - `GET /pptx/daa`
    - `GET /pptx/tma`
    - `GET /pptxgenjs/brief`
    - `POST /pptxgenjs/brief`
- **Simpler Structure:** Replace dynamic directory scanning with an explicit route registry or standard Express router modules.
  - **Option A (Centralized Route Table):** An explicit array of route definitions imported statically. Provides immediate compile-time type safety, instantaneous startup without disk I/O, full static discoverability via IDE "Find References", and eliminates top-level await in `app.ts`.
  - **Option B (Domain Routers):** Mount standard Express routers: `app.use('/pdf', pdfRouter)`, `app.use('/pptx', pptxRouter)`.
  - Even if the file-based folder structure is preserved to avoid changing URLs, collapsing `get.ts` and `report.ts` into a single file per route eliminates ~15 redundant files.

### S2. Excessive micro-file fragmentation

- **Location:**
  - [src/config.ts](../../src/config.ts) (6 lines) merely re-exports from [src/config/index.ts](../../src/config/index.ts).
  - [src/pptx/jszip/charts/workbook/](../../src/pptx/jszip/charts/workbook/) contains 6 tiny modules:
    - `bounds.ts` (18 lines)
    - `column-name.ts` (10 lines)
    - `dimension.ts` (15 lines)
    - `rename-table-columns.ts` (28 lines)
    - `resize-table.ts` (45 lines)
    - `types.ts` (9 lines)
- **The Problem:** These workbook modules have exactly one consumer: [src/pptx/jszip/charts/resize-workbook-tables.ts](../../src/pptx/jszip/charts/resize-workbook-tables.ts). Splitting 120 lines of logic across 6 separate files creates file-hopping friction without providing reusable abstractions.
- **Actionable Fix:**
  - Move configuration assembly from `src/config/index.ts` directly into `src/config.ts` and remove `src/config/index.ts`.
  - Inline `bounds.ts`, `dimension.ts`, `cell-address.ts`, and `types.ts` into `resize-workbook-tables.ts`.
  - Merge `rename-table-columns.ts` into `resize-table.ts`.

### S3. Implementation library leaked into public route URLs

- **Location:** [src/routes/pptxgenjs/brief/](../../src/routes/pptxgenjs/brief/), [src/routes/pptx/daa/](../../src/routes/pptx/daa/).
- **The Problem:** PowerPoint generation routes are partitioned by the underlying library: `/pptx/daa` and `/pptx/tma` (JSZip-based) vs. `/pptxgenjs/brief` (PptxGenJS-based). A client should not know or care whether a presentation is built with template XML mutation or programmatic slide building.
- **Simpler Structure:** Group all presentation exports under `/pptx/` (e.g. `/pptx/brief`, `/pptx/daa`, `/pptx/tma`) or `/presentations/`. Keep the internal library choice as an implementation detail in `services/`.

---

## 3. What Could Be Simpler

### W1. Dual service injection mechanisms in `AppOptions`

- **Location:** [src/http/types.ts:10-33](../../src/http/types.ts#L10-L33), [src/reports/pptx.ts:25-27](../../src/reports/pptx.ts#L25-L27), [src/reports/pptx.ts:35-37](../../src/reports/pptx.ts#L35-L37), [src/reports/services.ts:47-55](../../src/reports/services.ts#L47-L55).
- **The Problem:** There are two concurrent ways to inject services for testing:
  1. The unified container `reports: ReportServices`, which provides `reports.override(definition, mockService)`.
  2. Legacy options in `AppOptions`: `templateReportDemo`, `presentations`, and `templatePresentations`.
     In `definePptxReport`, `definition.injectedService?.(dependencies)` takes precedence over `dependencies.reports?.get(definition)`. Furthermore, `templateReportDemo` overrides DAA and TMA simultaneously.
- **Simplification:** Remove `injectedService`, `templateReportDemo`, `presentations`, and `templatePresentations`. Standardize 100% of service injection and test mocking on `ReportServices.override()`. This deletes multiple branches and centralizes lifecycle management.

### W2. Prune unused template services and dead schemas

- **Location:** [src/reports/template.ts:16](../../src/reports/template.ts#L16), [src/services/jszip/power-point-template-service.ts:11](../../src/services/jszip/power-point-template-service.ts#L11), [src/services/jszip/contracts.ts:7](../../src/services/jszip/contracts.ts#L7).
- **The Problem:**
  - `templateService` is exported by `src/reports/template.ts` but has zero callers in the application.
  - `PowerPointTemplateService` is only called by `templateService` and has zero callers.
  - `pptxRenderSchema` is exported by `src/services/jszip/contracts.ts` and has zero callers.
  - Knip correctly flags `templateService` and `pptxRenderSchema` as unused exports.
- **Simplification:** If placeholder-based template replacement is not offered as an active API endpoint, delete `PowerPointTemplateService`, `templateService`, and `pptxRenderSchema`. Retain `templateFile()` in `src/reports/template.ts`, which is actively used by `daa` and `tma`.

### W3. Remove orphaned presentation template

- **Location:** `templates/Tmp2.pptx` (688 KB).
- **The Problem:** Commit `8b8afb6` deleted the `tmb` route and schema. `Tmp2.pptx` remains in the repository and is only referenced in a single unit test (`test/pptx/jszip/tmx-generation.test.ts`).
- **Simplification:** Remove `templates/Tmp2.pptx` from the active templates directory or move it to test fixtures if required strictly for unit tests.

### W4. Decouple or integrate the unused Data API subsystem

- **Location:** [src/data-api/](../../src/data-api/), [src/services/data-api-client.ts](../../src/services/data-api-client.ts), [src/services/data-api/](../../src/services/data-api/).
- **The Problem:** The repository maintains an elaborate upstream data client:
  - 5 schema files in `src/data-api/`
  - LRU caching with size tracking and SHA-256 cache-key hashing in `DataApiClient`
  - URL builder, request timeout wrapper
  - 4 runnable example suites under `examples/data-api/`
  - Context injection in `ReportServices` passing `dataApi` to all factories
    **Yet not a single production report route uses `dataApi`**. Both `DaaPocPresentationService` and `TmxPocPresentationService` generate random numbers via `createRandomDataGenerator`.
- **Simplification:**
  - If upstream integration is planned for near-term production reports, wire it into at least one real route (e.g. a factsheet PowerPoint export).
  - If not immediately needed, decouple `DataApiClient` from the core `ReportServices` container. Avoid carrying LRU cache tuning, upstream retry logic, and maintenance overhead for code that serves no runtime requests.

### W5. Eliminate identity re-parsing in Brief report

- **Location:** [src/routes/pptxgenjs/brief/schema.ts:7-16](../../src/routes/pptxgenjs/brief/schema.ts#L7-L16), [src/routes/pptxgenjs/brief/report.ts:17-26](../../src/routes/pptxgenjs/brief/report.ts#L17-L26).
- **The Problem:** `schema.ts` uses `briefInputSchema.pick({ ...all fields... }).strict()` to define `requestSchema`. Then in `report.ts`, `prepareInput` manually destructures every field (`filename, title, subtitle, author, accent, slides`), reconstructs an identical object literal, and invokes `briefInputSchema.parse(...)` a second time.
- **Simplification:** Replace lines 17–26 of `brief/report.ts` with:
  ```ts
  prepareInput: (input) => ({
    filename: input.filename,
    input,
  }),
  ```
  This eliminates 10 lines of repetitive boilerplate and redundant CPU parsing.

---

## 4. Refactoring Opportunities

### R1. Consolidate duplicated formatted-run text replacement

- **Location:** [src/pptx/jszip/placeholders/replace-token-across-runs.ts:3-25](../../src/pptx/jszip/placeholders/replace-token-across-runs.ts#L3-L25), [src/pptx/jszip/text/replace-paragraph-text.ts:31-41](../../src/pptx/jszip/text/replace-paragraph-text.ts#L31-L41).
- **Duplication:** Both functions implement the exact same algorithm: calculating run boundary offsets across `<a:r><a:t>` nodes in a PowerPoint paragraph, determining overlap with a target substring range `[start, end]`, and updating `node.textContent` with `slice()` while maintaining run formatting.
- **Refactoring:** Extract a unified helper in `src/pptx/jszip/text/replace-run-range.ts`:
  ```ts
  export function replaceRunRange(
    nodes: Element[],
    originalTexts: string[],
    start: number,
    end: number,
    replacement: string,
  ): void {
    let offset = 0;
    for (let i = 0; i < nodes.length; i++) {
      const nodeStart = offset;
      const nodeEnd = offset + originalTexts[i].length;
      offset = nodeEnd;
      if (nodeEnd <= start || nodeStart >= end) continue;
      const current = nodes[i].textContent ?? '';
      nodes[i].textContent =
        current.slice(0, Math.max(0, start - nodeStart)) +
        (start >= nodeStart ? replacement : '') +
        current.slice(Math.min(originalTexts[i].length, end - nodeStart));
    }
  }
  ```
  Call this shared helper from both `replaceTokenAcrossRuns` and `replaceParagraphText`.

### R2. Consolidate spreadsheet column conversions

- **Location:**
  1. [src/pptx/jszip/charts/ranges.ts:20-33](../../src/pptx/jszip/charts/ranges.ts#L20-L33)
  2. [src/pptx/jszip/charts/workbook/column-name.ts:1-9](../../src/pptx/jszip/charts/workbook/column-name.ts#L1-L9)
  3. [src/pptx/jszip/spreadsheet.ts:35-39](../../src/pptx/jszip/spreadsheet.ts#L35-L39)
  4. [src/pptx/jszip/charts/workbook/cell-address.ts:14-17](../../src/pptx/jszip/charts/workbook/cell-address.ts#L14-L17)
- **Duplication:** Converting Excel column letters to 1-based indices (e.g. `'AA'` → `27`) and vice versa is implemented four times. In `ranges.ts`, the conversion enforces Excel's 16,384 column limit, whereas `column-name.ts` and `spreadsheet.ts` have no bounds checks.
- **Refactoring:** Export canonical helpers from [src/pptx/jszip/spreadsheet.ts](../../src/pptx/jszip/spreadsheet.ts):
  - `columnNameToNumber(column: string): number`
  - `columnNumberToName(index: number): string`
    Delete `src/pptx/jszip/charts/workbook/column-name.ts` and replace local conversions across all callers.

### R3. Unify repetitive DAA and TMA presentation report boilerplate

- **Location:** [src/routes/pptx/daa/report.ts](../../src/routes/pptx/daa/report.ts), [src/routes/pptx/tma/report.ts](../../src/routes/pptx/tma/report.ts).
- **Duplication:** Both reports define identical request schemas (`TEXT_ME: documentTextSchema`), identical query readers (`req.query`), and identical structure, differing only in template filename and service class.
- **Refactoring:** If custom template POCs are retained, create a lightweight helper `definePresentationDemo({ name, templateFile, serviceClass })` to remove duplicate route wiring.

### R4. Fix naming typo and clock consistency in TMX service

- **Location:** [src/services/jszip/tmx-poc-presentation-service.ts:23](../../src/services/jszip/tmx-poc-presentation-service.ts#L23), [src/services/jszip/tmx-poc-presentation-service.ts:61](../../src/services/jszip/tmx-poc-presentation-service.ts#L61).
- **Issue:** `subtitile` is misspelled in `templateSettings.objects.subtitile` and local variable names.
- **Refactoring:** Rename `subtitile` to `subtitle`. Ensure date derivations consistently use UTC arithmetic (`getUTCDate()`, `setUTCDate()`) from a single captured `now` instance.

---

## 5. Operational Resilience & Reliability

### O1. Chromium disconnect deadlock in readiness checks

- **Location:** [src/services/pdf/web-page-pdf.ts:44-48](../../src/services/pdf/web-page-pdf.ts#L44-L48), [src/runtime.ts:31-39](../../src/runtime.ts#L31-L39).
- **The Problem:**
  - When Chromium crashes or disconnects, `browser.on('disconnected')` sets `#state = RendererState.Disconnected` and `#browserPromise = undefined`.
  - The readiness endpoint `/internal/ready` checks `pdf.stats.state === RendererState.Ready`. Disconnection immediately causes readiness to return `ready: false` (HTTP 503).
  - In `WebPagePdfService`, Chromium is **only launched lazily upon receiving an export request** (`generate()` calls `this.browser()`).
  - **Deadlock:** Cloud orchestrators (Kubernetes, Azure App Service) stop routing incoming traffic to instances reporting unready. Because no requests reach the container, `generate()` is never invoked, and Chromium is never relaunched. The instance remains permanently unready until killed.
- **Actionable Fix:**
  - Either:
    1. In the `disconnected` event handler, schedule an immediate or backoff-bounded background relaunch if the server is not shutting down:
       ```ts
       browser.on('disconnected', () => {
         this.#disconnects++;
         this.#state = RendererState.Disconnected;
         this.#browserPromise = undefined;
         if (!this.closing) void this.browser().catch(() => {});
       });
       ```
    2. Or, terminate the Node.js process (`process.exit(1)`) on unexpected browser disconnect so the orchestrator provisions a fresh, healthy container.

### O2. Shutdown deadline terminates active renders

- **Location:** [src/runtime.ts:55](../../src/runtime.ts#L55), [src/config/environment.ts:53](../../src/config/environment.ts#L53).
- **The Problem:** `shutdown()` sets a fixed hard exit timer:
  ```ts
  const deadline = setTimeout(() => process.exit(1), 15000).unref();
  ```
  However, `RENDER_TIMEOUT_MS` defaults to 30 seconds and can be configured up to 120 seconds. If SIGTERM arrives during deployment while an active 25-second PDF render is underway, the process is killed after 15 seconds, dropping the client connection.
- **Actionable Fix:** Calculate the shutdown drain deadline dynamically based on configured limits:
  ```ts
  const drainBudgetMs = Math.max(config.timeout, 15000) + 5000;
  const deadline = setTimeout(() => process.exit(1), drainBudgetMs).unref();
  ```

### O3. Unbounded JSON response reading in `DataApiClient`

- **Location:** [src/services/data-api/request.ts:30](../../src/services/data-api/request.ts#L30).
- **The Problem:** `body = await response.json()` buffers and parses the entire upstream response body into memory without capping bytes read. If an upstream service returns a malformed 100 MB JSON payload, Node.js will deserialize the entire stream synchronously before `LRUCache.maxSize` or Zod schema validation can reject it, risking Out-Of-Memory process termination.
- **Actionable Fix:** Read the response body using a stream reader that counts received bytes and aborts if content exceeds a safe limit (e.g. 5 MB):
  ```ts
  const MAX_BYTES = 5 * 1024 * 1024;
  // Inspect Content-Length header and abort reader if stream exceeds MAX_BYTES
  ```

### O4. Broken Azure package test script

- **Location:** [package.json:15](../../package.json#L15).
- **The Problem:** `"test:azure": "tsx --test test/deployment/azure-package.ts"`. The `test/deployment/` directory does not exist. Running `npm run test:azure` immediately exits with code 1.
- **Actionable Fix:** Either restore `test/deployment/azure-package.ts` to test the built `output/azure/generator-api.zip`, or remove the script and its documentation references from `docs/azure.md` and `development.md`.

---

## 6. Proposed Target Architecture

The following file tree reflects a clean, streamlined architecture eliminating dead code, micro-files, and dynamic routing overhead:

```text
src/
├── index.ts                     # Process startup
├── runtime.ts                   # Lifecycle, shutdown, signal handling
├── app.ts                       # Express setup, middleware, centralized router mounting
├── errors.ts                    # AppError definition
├── date-time.ts                 # UTC date formatting utilities
├── config.ts                    # Consolidated configuration (inlines config/index.ts)
├── config/
│   ├── defaults.ts              # Print and cache defaults
│   └── environment.ts           # Environment schema validation
├── http/
│   ├── types.ts                 # Clean AppOptions (standardized on ReportServices)
│   ├── download.ts              # Attachment headers, queueing, HEAD support
│   ├── error-handler.ts         # Generic client envelopes (no path disclosure)
│   ├── input.ts                 # Query and body transport decoding
│   └── observability.ts         # Request timing and structured completion logging
├── routes/                      # Standardized, explicit route definitions
│   ├── health.ts                # /health endpoint
│   ├── internal.ts              # /internal/ready and /internal/metrics
│   ├── pdf/
│   │   ├── example.ts           # /pdf/example (merged report + schema)
│   │   ├── factsheet.ts         # /pdf/factsheet/:id (fixed query parameters)
│   │   ├── onepager.ts          # /pdf/onepager/:id
│   │   └── quarterly.ts         # /pdf/quarterly
│   └── pptx/
│       ├── brief.ts             # /pptx/brief (PptxGenJS, simplified schema)
│       ├── daa.ts               # /pptx/daa (JSZip demo deck)
│       └── tma.ts               # /pptx/tma (JSZip demo deck)
├── reports/
│   ├── pdf.ts                   # definePdfReport factory
│   ├── pdf-route.ts             # Webapp route mapping & query merging
│   ├── pptx.ts                  # definePptxReport factory
│   ├── services.ts              # Unified ReportServices container & override registry
│   └── template.ts              # templateFile() path resolver
├── services/
│   ├── pdf/
│   │   ├── contracts.ts         # PDF schemas & print settings
│   │   ├── navigation-boundary.ts # Origin & redirect interception
│   │   └── web-page-pdf.ts      # Chromium management with auto-recovery
│   ├── pptxgenjs/
│   │   ├── contracts.ts
│   │   └── power-point-generation-service.ts
│   └── jszip/
│       ├── contracts.ts
│       ├── template-source.ts   # Safe template loading (paths in cause only)
│       ├── random-data.ts       # Shared demo data generator
│       ├── daa-poc-presentation-service.ts
│       └── tmx-poc-presentation-service.ts
├── pptx/
│   ├── pptxgenjs/
│   │   └── templates/brief.ts   # Brief layout definition
│   └── jszip/
│       ├── objects.ts           # Named shape discovery
│       ├── spreadsheet.ts       # Canonical cell & column conversions
│       ├── text/
│       │   ├── replace-run-range.ts # Unified formatted-run replacement
│       │   ├── replace-paragraph-text.ts
│       │   └── fill-shape.ts
│       ├── tables/              # Table filling, row cloning, color setting
│       ├── slides/              # Slide duplication, listing, removal
│       └── charts/
│           ├── charts.ts        # Chart fill orchestration
│           ├── cache.ts         # XML chart cache update
│           ├── ranges.ts        # Chart formula range update
│           ├── series.ts        # Series manipulation
│           ├── point-colors.ts  # Slice & bar coloring
│           ├── resize-workbook-tables.ts # Merged workbook bounds & dimension logic
│           └── workbook/
│               └── resize-table.ts # Merged column renaming & table resizing
├── queue/
│   └── generation-queue.ts      # Bounded FIFO admission queue
└── validation/
    ├── control-characters.ts
    ├── document-id.ts
    ├── document-text.ts
    └── filename.ts
```

---

## 7. Action Plan & Priority Order

### Phase 1: Immediate Correctness & CI Fixes (Small, High Impact)

1. **Fix Factsheet Query Schema & Lint:**
   - Resolve unused `defaultLanguage` in [src/routes/pdf/factsheet/[id]/report.ts](../../src/routes/pdf/factsheet/[id]/report.ts).
   - Update [src/routes/pdf/factsheet/[id]/schema.ts](../../src/routes/pdf/factsheet/[id]/schema.ts) to accept `language` and `year`.
2. **Fix Template Path Disclosure:**
   - In [src/services/jszip/template-source.ts](../../src/services/jszip/template-source.ts), keep the file path in `cause` and return a generic public error message in `AppError`.
3. **Format Code:**
   - Run Prettier on the 4 out-of-style files to pass `npm run format:check`.
4. **Reconcile Endpoint Documentation:**
   - Update [docs/guides/endpoints.md](../guides/endpoints.md) to match current URLs (`/pdf/example`, `/pptx/daa`, `/pptx/tma`, `/pptxgenjs/brief`).

### Phase 2: Test Suite Restoration (Essential Quality Gate)

1. **Restore HTTP Route Tests:**
   - Recreate `test/http/` test coverage for PDF routes, PPTX routes, error handling, and HEAD requests using `supertest`.
   - Verify that all route `report` exports are consumed, resolving Knip's unused export findings.
2. **Resolve `test:azure` Script:**
   - Either provide a lightweight smoke test for the Azure ZIP artifact or clean up the package script.

### Phase 3: Simplification & Dead Code Elimination (Maintainability)

1. **Unify Service Injection:**
   - Remove legacy `templateReportDemo`, `presentations`, and `templatePresentations` options from `AppOptions`. Migrate tests to `ReportServices.override()`.
2. **Prune Unused Code:**
   - Remove `templateService`, `PowerPointTemplateService`, and `pptxRenderSchema`.
   - Remove orphan template `templates/Tmp2.pptx`.
   - Simplify Brief's identity destructuring in `report.ts`.
3. **Consolidate Micro-Files:**
   - Merge `src/config/index.ts` into `src/config.ts`.
   - Merge workbook table micro-helpers into `resize-workbook-tables.ts` and `resize-table.ts`.

### Phase 4: Refactoring Duplication & Operational Resilience

1. **Deduplicate Text & Spreadsheet Logic:**
   - Extract `replaceRunRange` across formatted text runs.
   - Consolidate column letter/number conversions in `spreadsheet.ts`.
2. **Resilience Improvements:**
   - Add background reconnection / relaunch for Chromium disconnects to avoid readiness deadlock.
   - Dynamically size the shutdown drain timeout against configured render limits.
   - Enforce an upstream body byte cap in `requestDataApi`.
