# Architecture & Request Flow

[Back to Documentation Index](../README.md)

## Code Map

| Area                                 | Files                                                                                                                                          |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Entrypoint & process lifecycle       | `src/index.ts`, `src/runtime.ts`                                                                                                               |
| Express app, middleware, request IDs | `src/app.ts`, `src/http/`, `src/errors.ts`, `src/observability/`                                                                               |
| Environment & shared defaults        | `src/config/defaults.ts`, `src/config/schema.ts`, `src/config/index.ts`                                                                        |
| Explicit router & route definitions  | `src/routes/router.ts`, `src/routes/**/{report,schema}.ts`                                                                                     |
| Report factories & service registry  | `src/reports/pdf.ts`, `src/reports/pptx.ts`, `src/reports/template.ts`, `src/reports/services.ts`                                              |
| Admission queues                     | `src/queue/generation-queue.ts`, `src/queue/schema.ts`                                                                                         |
| PDF rendering & navigation boundary  | `src/services/pdf/web-page-pdf.ts`, `src/services/pdf/render-page.ts`, `src/services/pdf/navigation-boundary.ts`, `src/services/pdf/schema.ts` |
| PowerPoint services                  | `src/services/jszip/`, `src/services/pptxgenjs/`                                                                                               |
| OpenXML & PptxGenJS utilities        | `src/pptx/jszip/`, `src/pptx/pptxgenjs/`                                                                                                       |
| Upstream Data API client & schemas   | `src/services/data-api-client.ts`, `src/services/data-api/`, `src/data-api/`                                                                   |
| Shared utilities & validation        | `src/utils/`, `src/validation/`                                                                                                                |

## Request Lifecycle

1. **Routing (`src/routes/router.ts`)**: Statically imports and registers route
   handlers on an Express router. No filesystem scanning or dynamic imports run
   at startup. `GET` routes automatically support `HEAD` via Express.
2. **Input Decoding (`src/http/input.ts`)**: `decodeExportInput` reads `req.body`
   for `POST` or `req.query` for `GET`/`HEAD` (rejecting repeated query keys and
   JSON-parsing only fields listed in `jsonFields`). Routes with path params or
   custom query structures provide `readRequestInput`.
3. **Validation & Preparation (`src/reports/pdf.ts`, `src/reports/pptx.ts`)**:
   - `definePdfReport` validates input with the route's Zod `schema`, maps it
     via `prepareInput`, merges report-owned `print` overrides, validates
     against `pdfRenderSchema`, and dispatches through `sendDownload`.
   - `definePptxReport` resolves the report's singleton service from
     `ReportServices`, validates the request with `schema`, maps `{ filename, input }`
     via `prepareInput`, validates `filename`, and dispatches through
     `sendDownload`.
4. **Queueing & Download (`src/http/download.ts`, `src/queue/generation-queue.ts`)**:
   - `HEAD` sets `Cache-Control: no-store`, `Content-Disposition`, and
     `Content-Type` without entering the queue or rendering.
   - `GET`/`POST` enter `queues.pdf` (default concurrency `2`) or
     `queues.presentations` (default concurrency `4`), each with `maxPending: 200`
     and `waitTimeoutMs: 120000`.
   - Client disconnects abort waiting jobs (`499 REQUEST_CANCELLED`) and signal
     running generators, which stop at their next step (PDF: the browser context
     is closed; PPTX: between fetch, prepare, render and serialize). A slot is
     released only after the generator has settled and cleaned up.

## Service Lifecycle & Shutdown

- `ReportServices` (`src/reports/services.ts`) instantiates one service per
  report definition and runs `validate()` across all registered services at
  startup. Template validation failures mark readiness as `failed` and log a
  `template_validation_failed` event.
- `createApp` accepts injected `reports`, `pdf`, `queues`, and `readiness` so
  tests can override services via `reports.override(definition, mockService)`.
- On `SIGINT`/`SIGTERM`, `src/runtime.ts` closes both admission queues, stops
  accepting new HTTP connections, awaits `pdf.close()` and `reports.close()`,
  and enforces an exit deadline of `RENDER_TIMEOUT_MS` + 5 seconds so active
  renders can finish. `shutdown_started`, `shutdown_completed` and
  `shutdown_deadline_exceeded` log events record queue and browser state.
