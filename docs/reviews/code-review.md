# Code review: simplicity, safety, and human readability

Reviewed on 2026-10-13 against the current working tree. Application code was left unchanged. This report covers startup, configuration, discovered routes, HTTP validation/downloads/errors, queues, report services, browser rendering, Data API access, representative PowerPoint text/chart/workbook operations, tests, and deployment tooling. It is a current assessment; the successful checks recorded in `project-review.md` describe an earlier revision.

The architecture is mostly sensible. The immediate problem is an incomplete contract migration: route files, tests, examples, and deployment instructions disagree. Fix those failures before reorganizing folders. Most simplification opportunities are deleting obsolete compatibility paths and merging small helpers, rather than introducing another framework.

## What is already fine

- `routes/`, `services/`, `pptx/`, `config/`, and `examples/` have distinct responsibilities. Report definitions connect request contracts to generation; PowerPoint XML operations stay outside HTTP handlers.
- Strict Zod schemas reject undeclared parameters. Document IDs and filenames reject path syntax. Template files come from trusted code, not request-controlled paths. No hardcoded credentials were found in the reviewed source; secrets and credential files were not opened.
- `createApp` supports fake services, so HTTP tests can verify downloads without Chromium. Error envelopes, request IDs, download headers, and HEAD handling have central owners.
- The queue limits active and waiting work and removes disconnected waiting jobs. Active tasks retain their slot until completion. Preserve that behavior.
- Chromium uses an isolated context per export and closes it in `finally`. Navigation restrictions include redirect-aware CDP interception. External assets are intentionally permitted for the documented trusted-webapp use case.
- Template source bytes are cached, while each generation gets a fresh mutable ZIP. Chart caches and embedded workbooks are updated together. The passing TMX tests verify editability and unchanged source presentations.
- No permissive CORS middleware was found. Internal endpoints are unauthenticated by design, with proxy restrictions documented. Deployment access controls were not available to inspect, so public exposure is not assumed.
- The existing browser/CDP boundary and XML relationship handling solve real problems. Their complexity is justified; replacing them with short, less complete checks would reduce safety.

## 🔴 Fix now

### R1. Every onepager request fails its own filename validation

**Where:** [onepager/report.ts:13](../../src/routes/pdf/onepager/[id]/report.ts#L13), [onepager/report.ts:30](../../src/routes/pdf/onepager/[id]/report.ts#L30), [filename.ts:3](../../src/validation/filename.ts#L3).

**Why:** The filename contains `HH:MM`, but the filename schema permits only letters, numbers, underscores, and hyphens. A valid `GET /pdf/onepager/id2222` therefore returns 400 before rendering; HEAD also fails. The date/time are captured at module import, so they would describe server startup even after the colon is removed. Prefixing an otherwise valid 80-character ID would also exceed the 80-character filename limit.

**Evidence:** Reproduced through Supertest: status 400, a filename regex validation error, and zero renderer calls. The existing onepager success tests fail for this reason.

**Simple fix:** Use `filename: id`, matching the documented contract. This deletes the timestamp code and avoids both character and length problems. If dated filenames are a deliberate requirement, compute one timestamp per request, use safe characters, and account for the total length without weakening path validation.

### R2. Tests import deleted routes and cannot execute

**Where:** [onet.test.ts:10](../../test/http/onet.test.ts#L10), [pptx-routes.test.ts:12](../../test/http/pptx-routes.test.ts#L12).

**Why:** Five imports still target `pdf/onet`, `pptx/jszip/{business,daa,summary}`, and `pptx/pptxgenjs/brief`. Those modules do not exist. The corresponding surviving definitions live under `pdf/example`, `pptx/daa`, and `pptxgenjs/brief`; business and summary definitions are absent. Two test files fail to load, hiding all of their behavior checks. Type checking and Knip fail on the same imports, blocking the CI verification stage.

**Evidence:** `npm run typecheck` reports five TS2307 errors. `npm run knip` reports five unresolved imports. `npm test` reports two file-level load failures.

**Simple fix:** Resolve the intended endpoint contract in R3, then update imports and URL assertions together. Remove obsolete business/summary cases only if those features were intentionally retired. Do not silence TypeScript or mark nonexistent modules as Knip entries. Keep lifecycle and validation assertions when updating the tests.

### R3. The published API and the discovered API disagree

**Where:** [README.md:28](../../README.md#L28), [endpoints.md:115](../guides/endpoints.md#L115), [endpoints.md:164](../guides/endpoints.md#L164), [examples/README.md:41](../../examples/README.md#L41), [factsheet/schema.ts:6](../../src/routes/pdf/factsheet/[id]/schema.ts#L6), [factsheet/report.ts:12](../../src/routes/pdf/factsheet/[id]/report.ts#L12).

**Why:** Copying several documented commands produces 404s. Factsheet documentation and tests promise `language`/`year` and a default language, but its strict query schema is empty and rejects both fields. `defaultLanguage` is declared but never used; code lint fails on it. These are observable disagreements, not proof that the older contract should automatically be restored.

**Evidence:** Route discovery produced the following export routes. GET registrations also support HEAD through Express and the shared download handler.

| Current registration             | Documented counterpart or discrepancy                                        |
| -------------------------------- | ---------------------------------------------------------------------------- |
| `GET /pdf/example`               | Documentation/test imports use `/pdf/onet`; download filename remains `onet` |
| `GET /pdf/quarterly`             | Matches the documented quarterly path                                        |
| `GET /pdf/factsheet/:id`         | Accepts no query fields; documented `language`/`year` requests return 400    |
| `GET /pdf/onepager/:id`          | Path exists, but R1 breaks valid downloads                                   |
| `GET /pptx/daa`                  | Documentation uses `/pptx/jszip/daa`, which returns 404                      |
| `GET /pptx/tma`, `GET /pptx/tmb` | Missing from the main endpoint matrix                                        |
| `GET, POST /pptxgenjs/brief`     | Documentation uses `/pptx/pptxgenjs/brief`                                   |
| No registration                  | `/pdf/test`, business, summary, and `/api/exports/...` examples              |

**Simple fix:** Choose one supported endpoint set and update method files, tests, the endpoint matrix, and runnable examples to match. If the current paths are intentional, deleting stale documentation is simplest. If clients require the old contract, restore that contract explicitly. For factsheet, either restore the declared fields/mapping/default or remove their promises and the unused variable. Avoid maintaining multiple route trees solely to accommodate inconsistent docs.

## 🟡 Should fix

### Y1. Template failures disclose internal paths to clients

**Where:** [template-source.ts:17](../../src/services/jszip/template-source.ts#L17), [error-handler.ts:53](../../src/http/error-handler.ts#L53), [error-handler.ts:69](../../src/http/error-handler.ts#L69).

**Why:** `TemplateSource` puts the absolute filename and original exception message into an `AppError`. The HTTP error handler sends every `AppError.message` verbatim. Missing or malformed server-owned templates can therefore reveal filesystem paths and parser details. The startup logger already has a place for detailed template diagnostics.

**Evidence:** A temporary HTTP reproduction with a missing template returned 500 and a message containing `/tmp/generator-review-missing-template.pptx` and the raw `ENOENT` description.

**Simple fix:** Keep the original error in `cause` for server diagnostics, but send a generic public message for `INVALID_TEMPLATE`. Preserve the status, code, and request ID. Extend the existing error tests to verify that paths appear only in server diagnostics.

### Y2. Deployment and output verification refer to deleted infrastructure

**Where:** [package.json:15](../../package.json#L15), [build-azure.mjs:66](../../scripts/build-azure.mjs#L66), [azure.md:22](../deployment/azure.md#L22), [development.md:193](../guides/development.md#L193), [test/README.md:28](../../test/README.md#L28), [Dockerfile:23](../../Dockerfile#L23).

**Why:** `test:azure` points to a nonexistent file. The ZIP builder requires `business.pptx`, but only `daa.pptx`, `Tmp1.pptx`, and `Tmp2.pptx` are present. Documentation promises `test:outputs` and `smoke:container`, neither of which exists in `package.json`. The Dockerfile does not run the promised smoke check. Historical review statements about these checks should not be read as current verification.

**Evidence:** `npm run test:azure` exits with “Could not find 'test/deployment/azure-package.ts'”. The template prerequisite and missing scripts were confirmed by inspection. The ZIP build was not executed.

**Simple fix:** Decide whether legacy ZIP deployment is still supported. If unused, delete its scripts, npm commands, and instructions together. If retained, align its prerequisites with the supported reports. Remove unsupported verification claims and broken links, including `src/routes/README.md` and `test/integration/output-routes.ts`. Reintroduce an actual artifact check only when the deployment workflow requires it; the current Docker health check does not verify document downloads.

### Y3. Important safeguards have lost executable regression coverage

**Where:** [generation-queue.ts:42](../../src/queue/generation-queue.ts#L42), [download.ts:30](../../src/http/download.ts#L30), [navigation-boundary.ts:20](../../src/services/pdf/navigation-boundary.ts#L20), [data-api/request.ts:12](../../src/services/data-api/request.ts#L12), [test/README.md:7](../../test/README.md#L7).

**Why:** The current test tree has no focused queue or Data API tests, although the test guide describes them. The navigation tests in `onet.test.ts` cannot load because of R2. Current passing PDF tests exercise readiness/network-idle behavior, but do not establish queue saturation/cancellation, the redirect boundary, or upstream timeout/redirect/cache correctness. These are precisely the behaviors that a simplification could accidentally break.

**Simple fix:** Repair the loading tests first. Restore a small set of observable checks alongside existing tests: full queues return 503; disconnects remove waiting jobs without releasing active slots; blocked redirects never reach the destination; upstream failures/timeouts preserve error codes. Retain GET/POST/HEAD assertions for shared handlers. Avoid a large new testing framework.

### Y4. Two implementations perform the same formatted-run replacement

**Where:** [replace-token-across-runs.ts:3](../../src/pptx/jszip/placeholders/replace-token-across-runs.ts#L3), [replace-paragraph-text.ts:35](../../src/pptx/jszip/text/replace-paragraph-text.ts#L35).

**Why:** Both calculate offsets in the original runs, process matches backwards, and replace the overlapping text while retaining formatting. Fixing one algorithm can leave the other with different behavior. These are substantive duplicates, unlike the one-line method exports.

**Simple fix:** Reuse one existing range-replacement operation from both callers. Keep literal-search matching/counting and placeholder-key validation in their respective callers. Do not create another abstraction layer. Verify split runs, repeated matches, and replacement text containing token syntax.

### Y5. Placeholder route wiring is unused but still presented as active functionality

**Where:** [template.ts:16](../../src/reports/template.ts#L16), [jszip/contracts.ts:7](../../src/services/jszip/contracts.ts#L7), [power-point-template-service.ts:11](../../src/services/jszip/power-point-template-service.ts#L11), [powerpoint.md:7](../services/powerpoint.md#L7).

**Why:** Knip reports `templateService` and `pptxRenderSchema` as unused exports. No current route calls the placeholder template factory, and no business/summary source deck remains. Its service class is reachable through that unused wrapper, so absence from Knip's unused-file list does not establish that it serves a request. The lower-level placeholder operation is used by examples and should not be deleted blindly.

**Simple fix:** After R3, remove the unused factory, service, contract, and compatibility option if placeholder export endpoints are retired. Keep `templateFile`, which current demo services use, and retain the example-used XML operations. If placeholder exports are required, restore one real route and test it instead of suppressing Knip.

### Y6. Two service injection systems complicate lifecycle and readiness

**Where:** [http/types.ts:10](../../src/http/types.ts#L10), [reports/pptx.ts:24](../../src/reports/pptx.ts#L24), [reports/pptx.ts:35](../../src/reports/pptx.ts#L35), [reports/services.ts:48](../../src/reports/services.ts#L48).

**Why:** Reports use either legacy `presentations`/`templatePresentations`/`templateReportDemo` options or the newer `ReportServices` container. Legacy injections take precedence and bypass container registration, validation, and cleanup. One `templateReportDemo` override also replaces DAA, TMA, and TMB together. A human must understand two ownership paths to explain one endpoint.

**Simple fix:** Migrate repository tests to `reports.override(report, fakeService)` and remove legacy injection callbacks/options after confirming external consumers no longer need them. This reuses an existing mechanism and deletes branches. Preserve the rule that externally supplied test services are externally managed.

### Y7. Data API memory consumption is not bounded by its cache settings

**Where:** [data-api/request.ts:30](../../src/services/data-api/request.ts#L30), [data-api-client.ts:49](../../src/services/data-api-client.ts#L49), [report-ids-schema.ts:5](../../src/data-api/report-ids-schema.ts#L5).

**Why:** `response.json()` reads and parses the complete body before schema validation and cache sizing. A timeout limits network waiting; it does not cap bytes received or synchronous JSON parsing. Cache `maxBytes` applies after the response is materialized. A large or faulty upstream response can therefore consume far more memory than the advertised cache limit. No current production export uses this client, so this is preparation for integration rather than a demonstrated public endpoint exploit.

**Simple fix:** Enforce a modest response-byte limit while reading the body, cancel the reader on overflow, and return a stable upstream error. Checking `Content-Length` alone is insufficient. Keep this within the existing request module; no new HTTP library is needed. Add sensible response collection limits when the real upstream contract is known.

### Y8. Shutdown promises more draining time than it allows

**Where:** [runtime.ts:49](../../src/runtime.ts#L49), [runtime.ts:55](../../src/runtime.ts#L55), [environment.ts:53](../../src/config/environment.ts#L53).

**Why:** Shutdown forces process exit after 15 seconds, while rendering defaults to 30 seconds and allows up to 120 seconds. A valid active render can be killed halfway through, producing a dropped connection during deployment. The fixed number and “drains active requests” wording hide the effective behavior.

**Simple fix:** Define one named shutdown budget that fits the host's termination allowance and the supported execution time, with room for cleanup. Document when forced exit can interrupt a job. Verify SIGTERM during an active render and rejection of pending jobs. Continue holding slots until real cleanup finishes.

### Y9. Browser recovery depends on traffic that readiness may exclude

**Where:** [runtime.ts:25](../../src/runtime.ts#L25), [runtime.ts:32](../../src/runtime.ts#L32), [web-page-pdf.ts:44](../../src/services/pdf/web-page-pdf.ts#L44), [Dockerfile:29](../../Dockerfile#L29).

**Why:** Warmup runs once. Launch failure or browser disconnection marks readiness false; only a subsequent PDF request triggers relaunch. With a host that routes traffic only to ready instances, no such request may arrive. This can leave an otherwise recoverable instance unhealthy. The code path is confirmed; whether the deployment restarts or starves that instance depends on hosting behavior and was not tested.

**Simple fix:** Choose an explicit failure policy: restart the process on browser failure/disconnection, or perform a bounded recovery attempt independent of request traffic. Keep readiness probes cheap. Avoid building a general background scheduler for this one lifecycle event.

## 🟢 Nice to have

### G1. Some tiny modules and identity mappings add avoidable reading hops

**Where:** [config.ts:1](../../src/config.ts#L1), [config/index.ts:8](../../src/config/index.ts#L8), [charts/workbook/dimension.ts:1](../../src/pptx/jszip/charts/workbook/dimension.ts#L1), [brief/schema.ts:7](../../src/routes/pptxgenjs/brief/schema.ts#L7), [brief/report.ts:17](../../src/routes/pptxgenjs/brief/report.ts#L17).

**Why:** `config.ts` only re-exports its implementation. Workbook table renaming and dimension updates involve several very small modules. Brief picks every field from the renderer schema, destructures all of them, rebuilds the same object, and parses it again. These steps have little explanatory value in the current identity mapping.

**Simple fix:** Move the config assembly into existing `config.ts` and remove `config/index.ts`. Merge private worksheet-bound/address/dimension helpers into the existing `resize-workbook-tables.ts`, and table-column renaming into the existing `resize-table.ts`. For brief, alias the schema and return the already validated input when no mapping is needed. Keep distinct validation for reports whose public and renderer contracts differ. Merge the tiny one-field DAA/TMA/TMB schemas into their respective report definitions if that reduces navigation; do not add a shared schema file just for three short declarations.

### G2. Spreadsheet column conversion is duplicated with different validation

**Where:** [charts/ranges.ts:20](../../src/pptx/jszip/charts/ranges.ts#L20), [charts/workbook/column-name.ts:1](../../src/pptx/jszip/charts/workbook/column-name.ts#L1), [spreadsheet.ts:35](../../src/pptx/jszip/spreadsheet.ts#L35), [charts/workbook/cell-address.ts:14](../../src/pptx/jszip/charts/workbook/cell-address.ts#L14).

**Why:** Column-letter/number conversion is repeated across four places. The chart-local conversion checks Excel's column limit, while the standalone conversion has no bounds check. Duplicate implementations make supported bounds harder to understand and maintain.

**Simple fix:** Consolidate conversion in existing `spreadsheet.ts`, which already handles worksheet cells, and reuse it. Delete the redundant column-name module and chart closure. Preserve rejection of invalid and out-of-range columns; test columns beyond Z and the supported upper limit.

### G3. Demo names, comments, and timestamps need a small cleanup

**Where:** [tmx-poc-presentation-service.ts:21](../../src/services/jszip/tmx-poc-presentation-service.ts#L21), [tmx-poc-presentation-service.ts:53](../../src/services/jszip/tmx-poc-presentation-service.ts#L53), [tmx-poc-presentation-service.ts:77](../../src/services/jszip/tmx-poc-presentation-service.ts#L77), [tma/schema.ts:13](../../src/routes/pptx/tma/schema.ts#L13), [tmb/schema.ts:13](../../src/routes/pptx/tmb/schema.ts#L13), [example/report.ts:17](../../src/routes/pdf/example/report.ts#L17).

**Why:** `subtitile` is misspelled; TMA/TMB comments say DAA; `/pdf/example` still downloads `onet.pdf`. `Tmp1.pptx`/`Tmp2.pptx` do not explain which demo uses them. TMX takes separate clock snapshots and combines UTC formatting with local date subtraction, which can produce inconsistent date labels around boundaries. Repetitive comments explain obvious random-number loops while the time convention remains implicit.

**Simple fix:** Correct the typo and copied comments, align the example filename with its endpoint, and rename the trusted template files to match TMA/TMB when doing that report's next maintenance change. Capture one `now` per generation and consistently derive UTC labels from it. Keep comments explaining template constraints, editability, and Excel's date-system quirks.

### G4. Two small dependency updates are available

**Where:** [package.json:51](../../package.json#L51), [package.json:61](../../package.json#L61), `package-lock.json`.

**Why:** Registry checks reported Zod `4.6.5 → 4.6.7` and Oxlint `1.87.0 → 1.88.0`. These are maintenance updates, not evidence of a security defect. Knip reported no unused dependencies, and the production audit reported zero known vulnerabilities.

**Simple fix:** Update them individually after the baseline checks pass. Run the existing validation/test checks for Zod and code lint for Oxlint. Keep Playwright, JSZip, PptxGenJS, Zod, and the XML parser; they serve separate needs. Removing the cache library is not justified without deciding whether upstream caching is still wanted.

The audit checks known registry advisories, so its clean result is not a security guarantee. [npm audit documentation](https://docs.npmjs.com/cli/v11/commands/npm-audit/). The update comparison uses npm's installed, wanted, and latest versions. [npm outdated documentation](https://docs.npmjs.com/cli/v11/commands/npm-outdated/).

## Simpler target structure

This is a conservative target after unsupported features are retired. It keeps current route URLs and existing responsibility boundaries. It adds no runtime folder or library. If R3 establishes a different public contract, preserve that contract when moving method files; file routing makes directory moves API changes.

```text
src/
├── index.ts
├── runtime.ts
├── app.ts
├── errors.ts
├── config.ts                    # assembly moved from config/index.ts
├── config/
│   ├── environment.ts
│   └── defaults.ts
├── routes/                      # folders continue to define URLs
│   ├── health/get.ts
│   ├── internal/{ready,metrics}/get.ts
│   ├── pdf/
│   │   ├── {example,quarterly}/{get,report,schema}.ts
│   │   └── {factsheet,onepager}/[id]/{get,report,schema}.ts
│   ├── pptx/{daa,tma,tmb}/{get,report}.ts
│   └── pptxgenjs/brief/{get,post,report,schema}.ts
├── reports/
│   ├── pdf.ts
│   ├── pdf-route.ts
│   ├── pptx.ts
│   ├── services.ts              # sole owned report-service lifecycle
│   └── template.ts              # trusted templateFile only if wrapper retired
├── http/
│   ├── {types,input,download,error-handler,observability}.ts
│   └── file-routes/             # retain discovery and duplicate/path checks
├── queue/generation-queue.ts
├── observability/
├── validation/
├── data-api/                    # endpoint registry and upstream schemas
├── services/
│   ├── data-api-client.ts
│   ├── data-api/{request,url}.ts
│   ├── pdf/{contracts,navigation-boundary,web-page-pdf}.ts
│   ├── jszip/                   # source loader and supported demo services
│   └── pptxgenjs/
└── pptx/
    ├── pptxgenjs/
    └── jszip/
        ├── {objects,charts,placeholders,spreadsheet}.ts
        ├── package/
        ├── text/               # one formatted-run replacement implementation
        ├── tables/
        ├── slides/
        └── charts/
            ├── {cache,ranges,series,load-workbook,point-colors}.ts
            ├── resize-workbook-tables.ts  # private bounds/dimension helpers here
            └── workbook/{resize-table,types}.ts

test/                           # retain behavior tests; repair stale imports
examples/                       # executable examples of supported operations
templates/                      # only trusted source decks still in use
scripts/                        # only supported build/deployment commands
docs/                           # current contracts; older review marked historical
```

Avoid moving business services into routes or putting unrelated operations into a generic `utils/` folder. The report service container, queue, and trusted template loader each have a useful job. There is no need to merge DAA and TMX into a generic configurable presentation engine: their different authored objects make explicit service code easier to follow.

## Request flow a new developer should be able to trace

`runtime.ts → createApp → discover/register method files → report definition → request decoder → strict schema → prepareInput → renderer contract where applicable → sendDownload → queue → service → attachment or centralized error handler`.

PowerPoint services are created when routes register, then validated by `reports.initialize()`. PDF service construction and browser warmup belong to runtime. HEAD validates and returns headers without queueing generation. The legacy injection branch in Y6 is the main avoidable fork in this flow.

## Verification performed

| Check                              | Current result                                                                                                          |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `npm run typecheck`                | Failed: five unresolved route imports; import-extension check completed                                                 |
| `npm run knip`                     | Failed: five unresolved imports and six unused exports; no unused dependencies reported                                 |
| `npm run lint:code`                | Failed: unused factsheet `defaultLanguage`                                                                              |
| `npm test`                         | 35 reported tests/file entries: 28 passed, 7 failed; two files failed to load                                           |
| Real Chromium tests included above | Readiness/network-idle tests passed; unloaded navigation test file is not counted as passing                            |
| `npm run test:azure`               | Failed: referenced test file is missing                                                                                 |
| `npm audit --omit=dev --json`      | Passed: zero known production dependency vulnerabilities                                                                |
| `npm outdated --json`              | Reported the Zod and Oxlint updates above                                                                               |
| Temporary local HTTP checks        | Confirmed route list, onepager 400, factsheet parameter rejection, documented DAA URL 404, and template path disclosure |

All checks used the existing dependencies, with Node.js 24.15.0. Sandbox startup failed for some commands because user namespaces were unavailable; those checks were rerun with permission. No code, dependency, or deployment changes were made. Full build, Azure packaging/deployment, Office appearance checks, production load tests, and external access controls were not verified. Knip findings should be reassessed after repairing imports; the four unused `report` exports may become used by corrected HTTP tests.

## Small, safe cleanup plan

1. **Fix onepager's filename only.** Use the documented ID filename and run `test/http/pdf-routes.test.ts`; distinguish remaining factsheet failures from this fix.
2. **Choose the supported API contract.** Align one route family at a time, including factsheet parameters and moved example/PPTX paths. Update its tests, endpoint docs, and examples in the same change.
3. **Restore executable verification.** Repair missing test imports, keep useful behavior assertions, and resolve the unused factsheet variable. Run type checking, Knip, code lint, and the full test suite.
4. **Fix template error disclosure.** Preserve detailed server diagnostics and verify a generic HTTP response using the existing tests.
5. **Reconcile deployment support.** Delete unused ZIP/output commands and their promises, or repair the supported commands. Verify the chosen artifact workflow before claiming it protects deployment.
6. **Protect lifecycle behavior.** Restore queue/navigation/upstream checks, then address shutdown and browser recovery independently. Run relevant tests after each change.
7. **Delete obsolete service wiring.** Remove retired placeholder export wiring first, then migrate legacy injections to existing report overrides. Run Knip, type checking, and HTTP tests after each deletion.
8. **Merge duplicated operations one at a time.** Start with formatted-run replacement, then spreadsheet conversions, then tiny config/workbook helpers. Run XML/workbook tests and build after moves.
9. **Finish small maintenance items.** Correct names/comments and consistent timestamps, then update each dependency separately. Run formatting checks for changed files and the relevant verification commands.
