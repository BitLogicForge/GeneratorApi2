# Architecture and code map

[Back to overview](../../README.md)

## Where to look

`src/index.ts` launches `src/runtime.ts`. Report-specific construction lives beside the route, so new reports do not change startup wiring.

| Area                                                         | Files                                                         |
| ------------------------------------------------------------ | ------------------------------------------------------------- |
| Startup, shared infrastructure, readiness, shutdown          | `src/runtime.ts`                                              |
| Middleware, request IDs, HTTP assembly                       | `src/app.ts`                                                  |
| Human-editable shared defaults                               | `src/config/defaults.ts`                                      |
| Environment validation and configuration assembly            | `src/config/environment.ts`, `src/config/index.ts`            |
| Report helpers and owned service lifecycle                   | `src/reports/pdf.ts`, `pptx.ts`, `template.ts`, `services.ts` |
| PDF URL/language settings, parameter mapping, and validation | `src/routes/pdf/**/{report,schema}.ts`                        |
| URLs and endpoint-specific definitions                       | `src/routes/**/{get,post}.ts`, `report.ts`                    |
| Discovery, ordering, duplicate detection                     | `src/http/file-routes/`                                       |
| Injected contracts, decoding, downloads, errors              | `src/http/`, `src/errors.ts`                                  |
| Queues, timeouts, cancellation                               | `src/queue/generation-queue.ts`                               |
| Chromium and PDF contracts                                   | `src/services/pdf/`                                           |
| PowerPoint generation and template services/contracts        | `src/services/pptxgenjs/`, `src/services/jszip/`              |
| Designs and XML/workbook utilities                           | `src/pptx/pptxgenjs/`, `src/pptx/jszip/`                      |
| Typed upstream API registry/client                           | `src/data-api/`, `src/services/data-api-client.ts`            |
| Source decks, examples, tests                                | `templates/`, `examples/`, `test/`                            |
| Azure deployment and ZIP packaging                           | `.gitlab-ci.yml`, [Azure guide](../deployment/azure.md)       |

## Request and report flow

Folders define URLs; method files re-export report factories. Discovery imports only supported method files, validates paths and duplicates, and registers static routes before parameters. It discovers compiled JavaScript in production. See [route conventions](../../src/routes/README.md).

A PDF definition declares its request schema, input mapping, and optional print overrides. `definePdfReport` performs transport decoding, request and renderer validation, then calls the injected Chromium service through `sendDownload`. The renderer owns the navigation boundary, browser/context lifecycle, and merged print settings. Report-specific settings never mutate shared defaults.

Each PPTX folder declares its public fields and decoding in `schema.ts`, then its trusted target, `prepareInput` mapping, output filename, and `createService` factory in `report.ts`. The mapping returns `{ filename, input }`; shared HTTP handling sends only the mapped input to the generator. `ReportServices` creates and retains one generator per definition per application. GET and POST share that generator. Startup initializes every registered report; validation failures keep readiness unavailable. The `template_validation_failed` startup event includes every failed template, its source file, error code, stack, and original cause. Named-object errors identify missing names (with available names), duplicate objects, or unsupported shapes and their slide paths. Shutdown drains active HTTP requests before closing Chromium and owned report services. Test overrides are externally managed and do not start real generators.

`templateService` registers a trusted template file with `PowerPointTemplateService`; route-local definitions own the public schema and mapping. Request parameters never select filesystem paths. Custom report factories receive validated config and a shared typed `DataApiClient`. Services return buffers and do not handle Express requests/responses.

`createApp` retains service injection for HTTP tests. PowerPoint report services are injected and overridden using the generic typed `reports.override(report, fakeService)` API. Renderer contracts live in service modules and do not import HTTP route schemas.

## Configuration

Shared editable defaults live in `config/defaults.ts`; environment parsing and Zod validation live in `config/environment.ts`. The configuration assembly contains shared settings; each PDF route folder owns its external page, query schema, defaults, and mapping. The root `config.ts` is a compatibility export.

Endpoint request schemas and business defaults stay with their report. The generic PDF test export independently lists its allowed webapp query fields. GET JSON decoding is declared by each report's `jsonFields` or input reader; the transport helper owns no global parameter registry.

## Queues and rendering

Both generation endpoints use separate bounded in-memory FIFO queues. `PDF_CONCURRENCY` defaults to 2 active PDF jobs and `PPTX_CONCURRENCY` to 4 active PowerPoint jobs per process. `QUEUE_MAX_PENDING` defaults to 200 waiting jobs **per queue**, in addition to active jobs. The endpoints still return the generated file directly; the HTTP connection stays open while waiting. `QUEUE_WAIT_TIMEOUT_MS` defaults to 120000 and limits waiting time before execution. Full queues and expired waits return 503 with `QUEUE_FULL` or `QUEUE_WAIT_TIMEOUT` and a `Retry-After: 5` header. Waiting jobs are removed when clients disconnect; already active jobs finish and retain their slot until completion. These limits are global per process, not per user. `RENDER_TIMEOUT_MS` defaults to 30000 and covers page navigation, readiness, fonts, and printing after browser setup. Every context closes on success or failure. Shutdown rejects waiting jobs, lets active requests finish, and closes Chromium, with a 15-second shutdown deadline.

See [development](../guides/development.md) for the complete PDF, template-PPTX, and custom-service workflows. [Output tests](../../test/integration/output-routes.ts) produce sample artifacts for manual inspection.
