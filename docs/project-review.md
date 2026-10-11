# Project review and improvement ideas

Reviewed on 2026-10-11. Scope: application wiring, GET/POST contracts, validation, queues, Chromium rendering, editable PowerPoint generation, upstream data access, tests, and deployment tooling.

## Fix status

The findings below describe the original review baseline. Each fix is maintained in a separate commit.

| Finding | Status | Regression coverage                                                                         |
| ------- | ------ | ------------------------------------------------------------------------------------------- |
| R1      | Fixed  | Chromium redirects, frames, script navigation, popups, and renderer recovery                |
| R2      | Fixed  | GET/POST XML text validation, Unicode preservation, and serialization guard                 |
| R3      | Fixed  | CI verification fails on lint/install/test errors; packaging smoke test gates deployment    |
| R4      | Fixed  | All export HEAD metadata, validation, unavailable services, and zero generation/queue work  |
| R5      | Fixed  | Embedded workbook grow/shrink, retained text/styles, dedicated ranges, and implicit cells   |
| R6      | Fixed  | Charset/encoding 415 responses, existing 400/413 responses, logging, and generic 500 safety |

The project has a good foundation for an internal document service. The six prioritized fixes are now implemented. The remaining recommendations focus on connecting the typed data client to a real report export and improving operability. Keep the current separation between HTTP handling, services, and document helpers.

## What is already working well

- **Testable architecture.** [AppOptions](../src/http/types.ts) and [createApp](../src/app.ts) allow HTTP tests to inject services without launching Chromium.
- **Consistent API contracts.** Strict Zod schemas, shared GET/POST handlers, request IDs, safe filenames, attachment headers, and generic unexpected-error responses are already in place.
- **Correct admission control.** [GenerationQueue](../src/queue/generation-queue.ts) bounds active and waiting work, preserves FIFO order, and retains active slots until tasks actually finish. Keep this behavior when adding cancellation or background jobs.
- **Editable PowerPoint output.** The JSZip helpers update chart caches and embedded workbooks together, resolve package relationships, preserve formatting, and keep source templates unchanged. Tests verify these properties.
- **Useful development tooling.** Type checking, Knip, import checks, Git hooks, clean compilation, and deployment-package tooling already exist. Improvements can build on them.

## Prioritized findings

P1 means fix before relying on the affected behavior in production. P2 means address in the next improvement cycle. Effort is relative to this repository: small is a localized change with tests; medium crosses several modules or the pipeline.

| ID  | Priority | Finding                                                            | Evidence                              | Expected effort |
| --- | -------- | ------------------------------------------------------------------ | ------------------------------------- | --------------- |
| R1  | P1       | PDF redirects bypass the configured-origin navigation boundary     | Reproduced with real Chromium         | Medium          |
| R2  | P1       | Accepted replacement text can produce malformed PPTX XML           | Reproduced with the summary template  | Small–medium    |
| R3  | P2       | Tests and lint do not gate CI deployment                           | Confirmed from pipeline configuration | Medium          |
| R4  | P2       | HEAD requests either generate documents or reject valid GET inputs | Reproduced through HTTP               | Small           |
| R5  | P2       | Chart resizing can make worksheet dimensions exclude retained data | Reproduced against the helper         | Small           |
| R6  | P2       | Unsupported JSON charsets become internal server errors            | Reproduced through HTTP               | Small           |

### R1. Enforce the PDF navigation boundary across redirects

**Location:** [web-page-pdf.ts:56](../src/services/pdf/web-page-pdf.ts#L56).

The route handler checks the origin of navigation requests and calls `route.continue()` for allowed requests. HTTP redirects following that request are not checked by the handler. Playwright documents that interception runs once for the original request and the browser follows the redirect chain itself. [Playwright redirect behavior](https://playwright.dev/docs/network#redirects).

**Observed:** a configured local origin returned a redirect to a second local server on a different port. The second server received one request, and `generate()` returned a PDF of its page. This affects both GET and POST exports because they use the same service.

**Effect:** an upstream redirect can produce a document from a different origin and make a network request outside the stated navigation boundary. Exploitability depends on the configured webapp having an externally directed redirect; the caller still cannot submit an arbitrary absolute route directly.

**Improvement:** enforce a redirect-aware policy that checks every navigation destination before following it. Reject redirect chains that cannot be validated, and retain permitted same-origin redirects. Network egress restrictions can provide an additional boundary. Checking the final `page.url()` is useful for detecting an unexpected destination, but happens after the network request.

**Acceptance tests:** same-origin redirects work; cross-origin and multi-hop escaping redirects fail; a blocked destination records zero requests; frames and browser-initiated navigations obey the intended policy.

### R2. Validate document text for XML compatibility

**Locations:** [schemas.ts:65](../src/schemas.ts#L65), [placeholders.ts](../src/pptx/jszip/placeholders.ts), [set-text.ts](../src/pptx/jszip/text/set-text.ts), and [write-xml.ts](../src/pptx/jszip/package/write-xml.ts).

Replacement values are length-checked strings, and DOM text assignment correctly escapes markup. However, XML-forbidden characters are accepted and serialized literally.

**Observed:** generating the summary template with replacements `{ "title": "A\u0001B", "subtitle": "Review", "customer": "Acme" }` succeeded. The resulting `ppt/slides/slide1.xml` contained the raw U+0001 character. XML 1.0 excludes that character. [XML character rules](https://www.w3.org/TR/xml/#charsets).

**Effect:** a successful export can contain malformed XML. Office may reject or repair the file; opening this reproduction in Office was not part of the review.

**Improvement:** introduce a document-text validator and apply it to externally supplied text that reaches XML, including replacement text and the DAA text field. Define whether invalid text is rejected or deliberately normalized. Preserve permitted tabs, newlines, and Unicode characters, including emoji. The existing path-control-character validator has a different purpose and rejects some whitespace that XML permits.

**Acceptance tests:** GET and POST reject forbidden characters consistently; permitted whitespace and Unicode survive generation; all generated XML parts remain well formed. Audit the PptxGenJS text fields separately before assuming its serializer behaves identically.

### R3. Make verification a CI requirement

**Locations:** [.gitlab-ci.yml:20](../.gitlab-ci.yml#L20) and [build-azure.mjs:47](../scripts/build-azure.mjs#L47).

The pipeline runs dependency installation, Knip, and Azure packaging. Packaging invokes type checking, so types are checked. It does not run `npm test`, code lint, formatting checks, or `npm run test:azure`. Workflow rules admit only the configured production and development branch pipelines; there is no merge-request verification path in this file.

**Effect:** the project's existing behavior tests can fail while the configured pipeline still packages and deploys the change. Local Git hooks do not replace remote verification.

**Improvement:** add a verification job for merge requests and relevant branches. Run code lint, type checking, Knip, formatting, browser installation, and the test suite. Make deployment depend on successful verification. After packaging, run the existing Azure smoke test against the artifact that will be deployed. Cache browser downloads with a key tied to the installed Playwright version, or use a compatible prepared test image.

**Acceptance tests:** an intentionally failing behavior test blocks deployment; a merge request receives checks; the packaged app passes real PDF/PPTX download checks before release.

### R4. Choose an explicit HEAD policy for generation routes

**Locations:** [input.ts:7](../src/http/input.ts#L7), [register.ts](../src/http/file-routes/register.ts), and [the document-link route](../src/routes/[id].pdf/get.ts).

Express invokes a GET handler for HEAD when no earlier HEAD handler exists. The file router already supports explicit HEAD handlers, but the actual generation routes do not define them. [Express routing methods](https://expressjs.com/en/5x/api/application/#app.METHOD).

**Observed:**

- `HEAD /id2222.pdf` returned 200 and called PDF generation.
- `HEAD /api/exports/pptx/jszip/daa` returned 200 and called presentation generation.
- `HEAD /api/exports/pdf?route=/report` returned 400 because `generationInput()` treats HEAD as a body-based request.

**Effect:** requests intended to inspect metadata can consume rendering capacity, while other export URLs reject the same query that GET accepts.

**Improvement:** define HEAD behavior explicitly. A reasonable policy for these computed exports is a validated metadata response without rendering, omitting length when it is unknown. Alternatively, document and return an explicit unsupported-method response. Use the router's existing HEAD ordering support.

**Acceptance tests:** every export has consistent HEAD semantics, correct headers, no response body, and no generation-service calls under the chosen metadata policy.

### R5. Recompute worksheet dimensions from all retained cells

**Location:** [resize-workbook-tables.ts:20](../src/pptx/jszip/charts/resize-workbook-tables.ts#L20).

The helper replaces the final row number of the worksheet's `dimension` with the chart's `lastRow`. A worksheet dimension describes all used cells, including cells with content or formatting. [Microsoft's SheetDimension documentation](https://learn.microsoft.com/en-us/dotnet/api/documentformat.openxml.spreadsheet.sheetdimension).

**Observed:** a sheet with dimension `A1:Z100` and a retained cell at `Z100` became `A1:Z2` when resizing the chart to row 2. The `Z100` cell was still present.

**Effect:** embedded-workbook metadata becomes inconsistent when a worksheet contains data beyond the chart. The small, dedicated chart worksheets in existing tests do not exercise this case.

**Improvement:** derive the used range from the retained cells after updates, including formatted cells. Continue restricting chart cleanup to its old data range. Do not shrink the worksheet's used range solely from chart size.

**Acceptance tests:** resizing a chart preserves unrelated cells and keeps them inside the dimension; growing and shrinking dedicated chart worksheets both produce correct dimensions.

### R6. Map recognized request-parser errors to their intended statuses

**Location:** [error-handler.ts:15](../src/http/error-handler.ts#L15).

The handler recognizes oversized bodies and malformed JSON but treats other parser errors as unexpected failures.

**Observed:** POSTing a valid PDF request with `Content-Type: application/json; charset=made-up` returned 500 `INTERNAL_ERROR`. The parser defines unsupported charsets as 415 `charset.unsupported`. [Express parser errors](https://expressjs.com/en/resources/middleware/body-parser/#errors).

**Effect:** a client input problem is reported and logged as a server failure, which misleads clients and inflates server-error monitoring.

**Improvement:** explicitly map known parser error types to stable public codes and statuses. Keep generic handling for unexpected failures rather than trusting an arbitrary error object's status or message. Document the added 415 response.

**Acceptance tests:** unsupported charsets and encodings return 415; malformed JSON remains 400; oversized bodies remain 413; request IDs and the existing error envelope remain consistent.

## Functionality with the strongest practical value

These are proposed extensions, not claims that the current documented POC is missing required behavior.

### 1. Generate a real report from an ID

The largest gap between the demo and a useful product is visible in [DaaPocPresentationService](../src/services/jszip/daa-poc-presentation-service.ts): table and chart values are random. [DataApiClient](../src/services/data-api-client.ts) and the report response schemas already provide most of the upstream integration foundation, but startup does not wire the client into generation.

Add a production report service that accepts an ID, language, and reporting period; fetches validated data; maps it to template objects; and returns an editable deck. A dedicated `/:id.pptx` link would complement `/:id.pdf`. Preserve the random-data endpoint as an explicit demo.

Separate the upstream response shape from the report model used by rendering. The current fixed 3×4 table and 20×3 chart schemas suit the demo template; a mapping layer will make other templates easier to support. Record the report ID, data revision, and template version so the same report can be reproduced from the same inputs. Verify workbook data, chart caches, and slide text against a known upstream fixture.

### 2. Offer template discovery and preflight validation

Introduce an internal template catalog with an ID, version, description, required placeholders or named objects, supported features, and request schema. Expose safe metadata through a catalog endpoint so consumers can discover what to send.

Use the same catalog for startup wiring and template checks. A preflight command can detect missing objects, duplicate names, unsupported charts, and broken relationships before requests arrive. This builds on [findNamedObjects](../src/pptx/jszip/objects.ts) and the current registered-template boundary; caller-controlled file paths are unnecessary.

### 3. Add PDF print profiles and reliable readiness

[WebPagePdfService](../src/services/pdf/web-page-pdf.ts) currently fixes margins and background printing and supports A4/Letter and landscape. Add a small set of validated print profiles for page numbering, headers/footers, branding, CSS page sizing, and accessible output where appropriate. Playwright exposes the relevant PDF options. [Playwright PDF API](https://playwright.dev/docs/api/class-page#page-pdf).

Give document-link exports a server-configured readiness marker. `/:id.pdf` currently waits for page load and fonts but cannot request `waitForSelector`; a webapp that loads report data afterward can be printed too early. Prefer an explicit report-ready signal over an arbitrary delay. Add a test where data appears asynchronously and verify that the exported document contains the final content.

### 4. Expand presentation content beyond bullet slides

The [brief design](../src/pptx/pptxgenjs/templates/brief.ts) only accepts titles and bullets. Add a few typed layouts with immediate reporting value: KPI cards, two-column comparisons, a chart slide, and a table slide. Use discriminated schemas per layout, keeping design logic outside route handlers.

Make overflow behavior explicit. Template replacements currently permit 5,000 characters without resizing authored text boxes; table growth can increase its slide extent. Decide whether to shrink text, split content into slides, or reject content that exceeds a layout's limits. Validate long text, Unicode, and dense tables visually before expanding the accepted ranges.

### 5. Add previews and regression artifacts

Create thumbnails or previews from generated artifacts so users can check layout before downloading. Keep previews tied to the same inputs and template version as the final file.

Extend the existing artifact workflow with representative short and long reports. Structural ZIP/XML tests protect editability; image comparisons or manual Office checks protect appearance. Use fixed fixtures and consistent fonts to make comparisons meaningful. Treat a chosen preview renderer's output as an approximation until PowerPoint compatibility has been checked.

### 6. Add background jobs and bundles when workload demands them

Current queues are deliberately local and synchronous: the connection remains open while waiting and generating. If real documents regularly exceed acceptable request durations, introduce a separate job API with 202 acceptance, status polling, bounded workers, persistent results, and expiration. Keep current synchronous endpoints for small exports. Microsoft's asynchronous request-reply pattern describes this flow. [Azure asynchronous request-reply guidance](https://learn.microsoft.com/en-us/azure/architecture/patterns/asynchronous-request-reply).

Once jobs exist, a batch export returning a ZIP of several PDFs/PPTXs becomes useful. Define maximum batch size, progress, retry behavior, and how partial failures are represented. Benchmark the current service first; the existing 200-job queue test uses synthetic tasks and does not establish document-rendering throughput.

## Code and maintainability improvements

| Improvement                                | Repository evidence                                                                                                              | Suggested change                                                                                                                                                                                                      |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reduce route duplication                   | Business and summary handlers differ primarily in their fixed template name                                                      | Extract a narrowly scoped template-download factory while retaining explicit GET/POST route files and validation. Avoid a general routing framework.                                                                  |
| Centralize template loading                | Both JSZip services read and unpack their template for every request                                                             | Share loading/preflight logic. Cache immutable source bytes if measurement warrants it, and create a fresh mutable ZIP for every generation.                                                                          |
| Clarify configuration ownership            | Startup constructs configured queues, while `createApp()` can construct default queues; PDF concurrency also has a service guard | Keep one composition-root policy for production limits and document standalone service behavior. Preserve injected queues for tests and the renderer's resource guard.                                                |
| Consolidate text-run replacement logic     | `placeholders.ts` and `text/replace-paragraph-text.ts` both replace ranges across formatted runs                                 | Extract a small shared paragraph-range operation, retaining each caller's placeholder validation and counts. Cover split runs, repeated tokens, and replacement strings containing token syntax.                      |
| Make upstream work bounded                 | `requestDataApi()` reads the complete JSON response before schema validation                                                     | Add a response-byte limit and, when report orchestration is introduced, a caller AbortSignal and overall request budget. Existing timeouts apply per upstream call.                                                   |
| Improve worksheet editing only when needed | `setWorksheetCell()` repeatedly scans rows/cells, and chart cleanup searches the sheet per removed cell                          | Benchmark larger charts. If costly, build per-worksheet row/cell indexes and batch updates; the current 20-row demo does not justify worker infrastructure by itself.                                                 |
| Define slide-removal semantics             | `removeSlide()` intentionally retains package parts to preserve shared assets                                                    | Keep that safe editing behavior. If an export must remove confidential content, add a separate relationship-aware cleanup pass and test that removed content is absent from the ZIP while shared assets remain valid. |

## Reliability and operational improvements

**Measure successful work as well as failures.** [app.ts](../src/app.ts) assigns request IDs, while the error handler logs server failures. Add structured completion events with route, format, status, queue wait, generation duration, and output bytes. Expose existing queue stats through internal metrics and track browser launches/disconnects. Avoid logging report text, tokens, or full query strings. This provides evidence for tuning concurrency and separating PDF/PPTX capacity settings.

**Separate liveness from readiness.** Keep `/health` as the inexpensive process check. Add internal readiness that reflects shutdown state, validated templates, and initialized renderer state, with a deliberate lazy-start or warmup policy. Avoid a fresh document render for every probe.

**Align shutdown with work budgets.** [index.ts:44](../src/index.ts#L44) has a fixed 15-second exit deadline, while normal PDF rendering defaults to 30 seconds and can be configured longer. An active request may therefore be cut off on termination. Make the drain budget explicit, fit it to the hosting environment, and test termination during active generation. Any cancellation must retain queue slots until actual cleanup completes.

**Verify browser recovery and disconnect behavior.** Existing PDF tests cover output, HTTP failures, readiness timeouts, and renderer capacity. Add focused tests for launch failure, browser disconnection/relaunch, timeout cleanup, and actual HTTP client disconnection while queued. Queue-unit cancellation tests do not exercise the response-close wiring in `sendDownload()`.

**Prepare browser dependencies before runtime where feasible.** [start-azure.sh](../scripts/start-azure.sh) installs Chromium and system libraries at startup. A prepared deployment image can reduce startup dependency on downloads and package installation. If retaining ZIP deployment, measure cold start and test the startup script in an Azure-equivalent environment; the current Azure smoke test launches `dist/index.js` directly.

**Match access controls to actual consumers.** The repository already describes an internal-use POC. Before expanding access to end users, define caller identity, document authorization, and fair per-caller admission so one consumer cannot occupy all capacity. For authenticated webapp pages, use a server-managed browser authentication strategy with clear scoping while preserving per-request context isolation.

## Documentation and packaging gaps to clean up

- **Resolved with R3:** [docs/azure.md](azure.md) now uses `/api/exports/pptx/jszip/daa` in the smoke example instead of the obsolete `/demo-report.pptx` URL.
- **Resolved with R4:** the canonical endpoint matrix in [docs/endpoints.md](endpoints.md) now includes summary, POST, and HEAD variants.
- [build-azure.mjs:66](../scripts/build-azure.mjs#L66) and [the package test](../test/deployment/azure-package.ts) explicitly require business and DAA templates, but not the registered summary template. All `.pptx` files are copied today; add explicit validation and a summary-download smoke case so a missing summary file is caught before deployment.
- Add Knip to the “verify and rebuild” instructions in [docs/development.md](development.md), matching the repository's change requirements.

## Suggested implementation order

1. **Completed:** R1–R6 now have regression coverage, deployment is gated on verification and package smoke tests, and affected endpoint documentation is updated.
2. **Useful reporting:** implement one real ID-based PowerPoint report, template preflight/catalog metadata, a reliable PDF readiness policy, and report provenance. Verify it with deterministic upstream fixtures and actual document inspection.
3. **Operate with evidence:** add timing/queue metrics, readiness, shutdown tests, and representative load measurements. Introduce background jobs, bundles, previews, or heavier performance changes when those measurements and consumer needs justify them.

## Verification performed during the initial review

| Check                               | Result                                                                     |
| ----------------------------------- | -------------------------------------------------------------------------- |
| `npm run typecheck`                 | Passed, including the import-extension check                               |
| `npm run knip`                      | Passed                                                                     |
| `npm test`                          | Passed: 65 tests, zero failures or skips; includes real Chromium rendering |
| `npm run build`                     | Passed                                                                     |
| Temporary local reproduction checks | Confirmed R1, R2, R4, R5, and R6                                           |

The initial reproduction checks used temporary files and localhost servers. Findings R3 and the documentation/packaging gaps came from inspection. That review added only the report; the subsequent fixes are tracked above.

Report formatting passed `npx --no-install prettier --check docs/project-review.md`.

Azure packaging/deployment, `npm run test:azure`, `npm run test:outputs`, Office visual inspection, dependency vulnerability scanning, and production load testing were not run during the initial review.

## Verification after the fixes

| Check                  | Result                                                                       |
| ---------------------- | ---------------------------------------------------------------------------- |
| `npm test`             | Passed: 76 tests, zero failures or skips, including the new regression cases |
| `npm run typecheck`    | Passed                                                                       |
| `npm run knip`         | Passed                                                                       |
| Code lint              | Passed through the commit hooks                                              |
| `npm run format:check` | Passed                                                                       |
| `npm run build`        | Passed                                                                       |
| `npm run build:azure`  | Passed with the final application changes                                    |
| `npm run test:azure`   | Passed: the resulting ZIP runs real PDF and PPTX downloads                   |

The GitLab pipeline and Azure deployment were not run remotely. Pipeline failure propagation was tested locally, and the deployment artifact was built and smoke-tested locally. Office visual inspection and production load testing remain outside these fixes.
