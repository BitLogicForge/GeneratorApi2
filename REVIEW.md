# Generator API — Project Review

_Reviewed: 2026-10-25 · Branch `auto3` @ `d89431a` · Scope: `src/`, `scripts/`, CI, docs, tests_

## Summary

The codebase is in good shape overall. It has strict Zod validation at the
edges, explicit route registration, a FIFO admission queue that keeps slots
until rendering finishes, an origin-locked Chromium navigation boundary, a
template registry with no request-controlled paths, and graceful shutdown. All
static checks pass (`typecheck`, `lint:code`, `knip`, `format:check`).

Most of the problems are at the seams. Errors are under-logged and over-exposed.
One report bypasses the shared Data API client. Deployment config disagrees with
the latest commit. Demo or placeholder code sits on production routes. The docs
have drifted from the code.

| Severity  | Count | Theme                                                          |
| --------- | ----- | -------------------------------------------------------------- |
| 🔴 High   | 5     | Error logging/leakage, deploy config, Data API client misuse   |
| 🟠 Medium | 9     | Error classification, shutdown timing, cancellation, demo code |
| 🟡 Low    | 12    | Docs drift, naming, duplication, hygiene                       |

---

## 🔴 High — obvious mistakes, fix first

### H1. Unexpected 500s are logged without the error itself

`src/http/error-handler.ts:67-73` logs only `{ event, requestId, status, code }`
for 5xx errors. The error object, its message, stack and `cause` are dropped.
The JSDoc says it keeps "unexpected error details in server logs", but the code
doesn't. A `TypeError` in a report, a Playwright crash or a JSZip failure all
end up as `INTERNAL_ERROR` with nothing to debug from.

**Fix:** log `error` (or `{ name, message, stack, cause }`) for status ≥ 500.
Consider also logging 4xx `AppError`s at `info`/`warn`.

### H2. Internal error messages, including absolute filesystem paths, are sent to clients

The handler returns `AppError.message` verbatim for every status, 500 included
(`src/http/error-handler.ts:58-59`). Several 500-level `AppError`s carry
internal details:

- `src/services/jszip/template-source.ts:63-67`: `Template "/home/site/wwwroot/templates/daa.pptx": ENOENT: no such file or directory…`
  This exposes the server path layout and raw Node error text.
- `invalidTemplate(...)` (`src/pptx/jszip/package/invalid-template.ts`) is
  used with messages such as `Series count mismatch: template has 3, data has 2`,
  `Object "X2_TAB1" (alias "x2Tab1") not found on slide 2 (ppt/slides/slide2.xml)`.

**Fix:** for `status >= 500`, return a generic public message
(`Document generation failed`) and log the detailed one, or add an
`exposeMessage` flag to `AppError`.

### H3. The TMA report ignores the shared Data API client, so the cache never works

`src/services/jszip/tmx-poc-presentation-service.ts:80-89`

```ts
console.debug({ PP1: input.PP1, PP2: input.PP2 });
const config = loadConfig(); // re-reads and re-validates process.env on every request
const api = new DataApiClient(config.dataApi); // new LRU cache per request → never hits
```

- `ReportServices` already builds a single `DataApiClient` and passes it in as
  `ReportContext.dataApi` (`src/reports/services.ts:107-111`), but
  `createService: () => new TmxPocPresentationService(...)`
  (`src/routes/pptx/tma/report.ts:18`) ignores the context. The configured
  `DATA_API_CACHE_*` settings therefore do nothing for this report.
- `console.debug` writes raw user input to logs on every request. That
  conflicts with the "never URLs or payloads" logging rule elsewhere.
- `loadConfig()` can throw on a bad env value mid-request instead of at startup.

**Fix:** `createService: (ctx) => new TmxPocPresentationService(path, ctx.dataApi)`
and remove the `console.debug`.

### H4. CI sets the Azure startup command to `bash`, but the last commit switched to `sh`

Commit `0bb67fc` ("use 'sh' instead of 'bash' for Azure deployment") updated
`package.json` and `docs/deployment/azure.md:106`, but `.gitlab-ci.yml`
(the `.azure_deploy` script) still runs:

```
az webapp config set … --startup-file 'bash scripts/start-azure.sh'
```

Every CI deploy overwrites the startup command with the version the commit
meant to remove.

### H5. Azure startup installs OS packages and Chromium on every boot

`scripts/start-azure.sh` runs `apt-get update && apt-get install` (when
`update-ca-certificates` is missing) and `playwright install --with-deps chromium`
on every container start. `--with-deps` calls `apt-get` each time. As a result:

- cold starts and restarts are slow and depend on the network (apt mirrors and
  the Playwright CDN), and a mirror outage stops the app from starting;
- the script needs root at runtime;
- `docs/deployment/azure.md:23` says Chromium installs "on first run", which
  isn't accurate for the system dependencies.

**Fix:** use a custom container image with Chromium and its dependencies baked
in, or at least guard the install with a marker file and a version check.

---

## 🟠 Medium

### M1. Server-side `ZodError`s are reported as client `400 VALIDATION_ERROR`

Every `ZodError` maps to 400 with `details` (`src/http/error-handler.ts:51-57`).
Some `.parse()` calls validate server-produced data, so a programming error
looks like a client error and leaks internal field paths:

- `src/reports/pdf.ts:37-48` (`preparedInputSchema.parse(prepareInput(...))`, `pdfRenderSchema.parse`)
- `src/reports/pptx.ts:44` (`filenameSchema.parse(prepared.filename)`)
- `src/routes/pptxgenjs/brief/report.ts:19` (re-parse in `prepareInput`)
- `src/services/pdf/schema.ts:38` (`resolvePdfPrintSettings` at render time)

**Fix:** use `parse` only for request input. Wrap internal validation so it
throws a plain `Error` (→ 500), or use `safeParse` and raise a 500 `AppError`.

### M2. Upstream data problems are reported as `INVALID_TEMPLATE`

Data API strings such as `raw.series.title` and `raw.breakdown.title` aren't run
through `documentTextSchema` (`src/data-api/tma-data-schema.ts`). A control
character from upstream makes `writeXml` throw `invalidTemplate()`
(`src/pptx/jszip/package/write-xml.ts:12`), which returns 500 `INVALID_TEMPLATE`.
Chart shape mismatches have the same problem. Operators will look at the wrong
component.

**Fix:** use `documentTextSchema` for every upstream string in the Data API
schemas, so bad data becomes `502 DATA_API_INVALID_RESPONSE`.

### M3. The shutdown deadline is shorter than a render can take

`src/runtime.ts:32` hard-exits after 15 s. `RENDER_TIMEOUT_MS` defaults to 30 s
and allows up to 120 s, so a SIGTERM during a long render kills it partway
through. That conflicts with "never release an active queue slot before
rendering finishes".

**Fix:** derive the deadline from `config.timeout` plus a margin, and keep it
under the platform's grace period (Azure App Service allows about 30 s by
default). Document the trade-off.

### M4. Client disconnects don't cancel running work

`sendDownload` aborts only jobs that are still waiting in the queue
(`src/http/download.ts:24-40`). After a job starts, the PDF render
(`src/services/pdf/web-page-pdf.ts`) and PPTX generation run to completion and
hold a slot even though the client is gone. Under load, abandoned requests take
capacity from live ones.

**Fix:** pass the `AbortSignal` into `generate(signal)`, and close the browser
context or check `signal.aborted` between steps.

### M5. Some render time isn't covered by the PDF timeout

The timeout timer starts only after browser launch, `newContext`, `newPage` and
CDP setup (`src/services/pdf/web-page-pdf.ts:89-107`). A hung `chromium.launch()`
has no timeout, so the queue slot is held indefinitely.

**Fix:** start the timer before `this.browser()`, or pass `timeout` to `launch()`.

### M6. Demo and placeholder code runs on production routes

- `src/services/jszip/Sample1/sample1-service.ts:169-171` clones the title,
  moves it 2 cm up and writes the literal `'xxx'` on every generated deck.
- `src/routes/pptx/sample1/report.ts:15` sets the download filename to `'aaa'`.
- `/pdf/example` renders `https://example.com` (`src/routes/pdf/example/report.ts`).
  It's a public endpoint that makes outbound requests to a third party and uses
  a Chromium slot.
- `/pptx/daa` and `/pptx/sample1` serve random data from `generateRandomData`.

**Fix:** put demo routes behind a flag such as `ENABLE_DEMO_ROUTES`, or remove
them from `createRouter` in production.

### M7. `/internal/metrics` and `/internal/ready` are unauthenticated

They expose `process.memoryUsage()`, queue depth, browser state and per-route
traffic to anyone (`src/routes/internal/metrics.ts`). Nothing in the app
restricts `/internal/*`.

**Fix:** add a shared-secret header or IP allowlist middleware, or document
that ingress must block `/internal/*`.

### M8. Data API responses have no size limit

`requestDataApi` calls `response.json()` with no byte limit
(`src/services/data-api/request.ts:33`). A misbehaving upstream can return a
very large payload and exhaust memory. Non-OK responses also aren't drained or
cancelled (`:25`), which keeps undici sockets open until GC.

**Fix:** check `Content-Length` and stream with a cap; call
`response.body?.cancel()` on the error paths.

### M9. PDF request logs contain full URLs, including query strings

`src/services/pdf/render-page.ts:30-68` logs `url.href` (ids, dates, benchmark
params) on every render, and it's enabled by default (`PDF_LOG_REQUESTS=true`).
This contradicts the "never URLs or payloads" principle in
`src/http/observability.ts:13`.

**Fix:** log `url.origin + url.pathname` by default, and make the query part opt-in.

---

## 🟡 Low — improvements and hygiene

### L1. Docs have drifted from the code

- `docs/guides/endpoints.md` route table: `/pptx/sample1` is missing, while
  `/pptx/generated` appears at line ~129 but isn't registered.
- The brief limits in the docs (title `1..120`, bullets `1..240`, notes `1..2000`)
  don't match `src/services/pptxgenjs/schema.ts` (title ≤ 100, bullets ≤ 220,
  notes ≤ 3000 and may be empty).
- `docs/deployment/azure.md:23` says "on first run" (see H5).

### L2. Hard-coded defaults will go stale

`src/routes/pdf/quarterly/schema.ts:6-7` defaults to `year=2026`, `quarter='3'`.
Derive these from the current date, or make them required.

### L3. TMA chart categories run newest to oldest

`tmx-poc-presentation-service.ts:95-99` builds dates from `asOf` backwards, so
index 0 is the newest date. `Sample1` uses `generateTimeSeriesDates`, which is
ascending. If the upstream `values` are chronological, the axis is reversed.
Reuse `generateTimeSeriesDates` and confirm the ordering with the Data API owner.

### L4. Copy-pasted comments and naming inconsistencies

- `src/routes/pptx/sample1/schema.ts:17` and `src/routes/pptx/tma/schema.ts:19`
  both say "DAA accepts direct text query parameters".
- The `Sample1/` directory and `templateSettings.ts` use PascalCase/camelCase,
  while the rest of `src/services/jszip/` uses kebab-case.
- The class is `TmxPocPresentationService`, but the route, schema and types say `tma`.
- Template filenames (`Tmp1.pptx`, `template_3.pptx`) don't say what they contain.
- `src/routes/pptx/tma/schema.ts:14` has a stray blank line inside the builder chain.

### L5. Two overlapping request-metrics systems

`createObservability` keeps a `totals` map (route × method × status) and also
`createEndpointMetrics` (route × method with `byStatus`). The data overlaps
almost entirely. `/internal/metrics` returns both as `requests` and `endpoints`.
Consider dropping `requests` once consumers have moved.

### L6. Fragile format detection in observability

`src/http/observability.ts:37-41` infers `format` with `route.includes('pptx')`.
Any future route with `pdf` or `pptx` in an unrelated segment would be
misclassified. Set `res.locals.format` in `sendDownload`, which already knows it.

### L7. Double concurrency gate for PDFs

The queue (`queues.pdf`, concurrency = `PDF_CONCURRENCY`) and
`WebPagePdfService.#active` (`web-page-pdf.ts:83-84`) enforce the same limit. The
second gate can only fire on a bug, and then it returns a confusing
`RENDER_BUSY`. Remove it, or keep it as an assertion and document why.

### L8. `templateService` / `PowerPointTemplateService` are only used by an example

`src/reports/template.ts:33` is marked `@public` to satisfy knip, but no route
uses it. Either add a placeholder-template route or move it into `examples/`.

### L9. Every file in the repo is mode `100755`

`git ls-files -s` shows 223 of 224 files as executable, including `.json`,
`.md`, `.ts` and `.gitignore`. This most likely came from WSL/Windows during the
"renormalize" commit. Run `git config core.fileMode` and set mode 644 on
everything except `scripts/*.sh`.

### L10. Unpinned CI images

`AZURE_CLI_IMAGE: mcr.microsoft.com/azure-cli:latest`, and `node:22-bookworm-slim`
floats on minor versions. Pin by tag or digest for reproducible deploys.

### L11. Thin test coverage of critical paths

There are only 4 test files (363 lines): date-time, PDF network-idle,
slide-duplication and table colors. Nothing covers:

- `GenerationQueue` (FIFO order, timeout, abort, `close()` draining)
- `createErrorHandler` (status mapping, parser errors, 503 `Retry-After`)
- `buildDataApiUrl` prefix escapes (`..`, `%2e%2e`, absolute URLs)
- `navigationBoundary` (redirects to another origin, popups, iframes)
- config parsing (`booleanEnv`, `LOG_EXCLUDE_ROUTES`)

These are small, pure and security-relevant, so they're cheap to test.

### L12. Minor code notes

- `src/services/data-api/url.ts:19`: the query is validated after the URL is
  built. Validate first.
- `src/services/data-api-client.ts:62-67`: an unknown endpoint is a programming
  error but returns 400 to the client.
- `src/pptx/jszip/package/write-xml.ts:12`: runs a full code-point scan of
  every serialized XML part on each write. This is fine at the current size but
  will grow with large decks; consider validating only inserted text, which is
  already done at the schema level.
- `src/services/pdf/navigation-boundary.ts`: blocks every Document request to
  another origin, iframes included. That's intentional, but any embedded
  third-party iframe (maps, video) fails the whole PDF with `NAVIGATION_BLOCKED`.
  Worth documenting in `docs/services/pdf.md`.
- `src/runtime.ts`: there's no `server.on('error')` handler, so `EADDRINUSE`
  crashes with an unstructured stack. Set `server.keepAliveTimeout` and
  `headersTimeout` explicitly to work with the Azure front end.

---

## What's done well

- **Security boundaries**: the PDF origin lock covers redirect hops via CDP
  `Fetch` plus Playwright routing, and service workers are blocked. Template
  paths come from a code-owned registry. Data API paths are confined to the base
  prefix, and redirects are refused (`redirect: 'manual'`). The XML 1.0
  character check guards against corrupt OOXML.
- **Admission control**: bounded FIFO queue with wait timeouts, cancellation of
  pending jobs, `503` + `Retry-After`, and drain on shutdown.
- **Validation**: `.strict()` request schemas reject unknown and repeated query
  params, and the env is validated once at startup.
- **Structure**: small single-purpose modules, clear `report → service → pptx`
  layering, and consistent `@/` aliases.
- **Tooling**: oxlint (type-aware), knip, Prettier and tsc all run clean in CI.

## Suggested order of work

1. H1, H2: error logging and redaction (small change, large operational benefit)
2. H4: CI startup command (one-line fix)
3. H3: TMA uses `ctx.dataApi` and drops the `console.debug`
4. M6, M7: feature-flag demo routes and protect `/internal/*`
5. M1, M2: correct error classification
6. M3, M4, M5: shutdown and cancellation timing
7. H5: bake Chromium into the image
8. L-items, alongside the tests from L11
