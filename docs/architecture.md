# Architecture and code map

[Back to overview](../README.md)

## Where to look

Start with `src/index.ts` for service wiring, then `src/app.ts` for the HTTP flow. Use this guide to find the code for a specific change.

| File                                                                                                                                                   | Purpose / when to look here                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| [src/index.ts](../src/index.ts)                                                                                                                        | Starts the server, registers template files, wires services and queues, and handles shutdown.                  |
| [src/app.ts](../src/app.ts)                                                                                                                            | Sets up middleware, request IDs, routers, and error handling.                                                  |
| [src/config.ts](../src/config.ts)                                                                                                                      | Defines document route/language defaults and validates environment settings and runtime limits.                |
| [src/schemas.ts](../src/schemas.ts)                                                                                                                    | Defines accepted export inputs, validation rules, and inferred TypeScript types.                               |
| [src/pdf-route.ts](../src/pdf-route.ts)                                                                                                                | Validates document IDs and route patterns; expands `{id}` for direct PDF links.                                |
| [src/routes/health/get.ts](../src/routes/health/get.ts)                                                                                                | Handles `GET /health`.                                                                                         |
| [src/routes/[id].pdf/get.ts](src/routes/[id].pdf/get.ts)                                                                                               | Handles `GET /:id.pdf`.                                                                                        |
| [src/routes/api/exports/pdf/](../src/routes/api/exports/pdf/)                                                                                          | Handles `GET/POST /api/exports/pdf`.                                                                           |
| [src/routes/api/exports/pptx/jszip/daa/get.ts](../src/routes/api/exports/pptx/jszip/daa/get.ts)                                                        | Handles `GET /api/exports/pptx/jszip/daa`.                                                                     |
| [src/routes/api/exports/pptx/pptxgenjs/brief/](../src/routes/api/exports/pptx/pptxgenjs/brief/)                                                        | Handles `GET/POST /api/exports/pptx/pptxgenjs/brief`.                                                          |
| [src/routes/api/exports/pptx/jszip/business/](../src/routes/api/exports/pptx/jszip/business/)                                                          | Handles `GET/POST /api/exports/pptx/jszip/business`.                                                           |
| [src/http/types.ts](../src/http/types.ts)                                                                                                              | Declares injectable service contracts. Update these when wiring a new service into routes.                     |
| [src/http/input.ts](../src/http/input.ts)                                                                                                              | Converts GET query fields into export inputs. Add decoding here for new structured query fields.               |
| [src/http/download.ts](../src/http/download.ts)                                                                                                        | Queues generation, cancels waiting work on disconnect, and sends file attachments.                             |
| [src/http/error-handler.ts](../src/http/error-handler.ts), [src/errors.ts](../src/errors.ts)                                                           | Define application errors and translate failures into HTTP responses and logs.                                 |
| [src/queue/generation-queue.ts](../src/queue/generation-queue.ts)                                                                                      | Controls concurrency, pending capacity, wait timeouts, cancellation, and shutdown admission.                   |
| [src/services/pdf/web-page-pdf.ts](../src/services/pdf/web-page-pdf.ts)                                                                                | Manages Chromium, navigation restrictions, page readiness, printing, and browser context cleanup.              |
| [src/services/pptxgenjs/power-point-generation-service.ts](../src/services/pptxgenjs/power-point-generation-service.ts)                                | Registers code-based presentation designs and creates a fresh deck for each export.                            |
| [src/pptx/pptxgenjs/templates/brief.ts](../src/pptx/pptxgenjs/templates/brief.ts)                                                                      | Defines the brief deck's slide layout, typography, colors, and speaker notes. Change its visual design here.   |
| [src/services/jszip/power-point-template-service.ts](../src/services/jszip/power-point-template-service.ts)                                            | Replaces `{{tokens}}` in existing slide and note text, including tokens split across formatting runs.          |
| [src/services/jszip/daa-poc-presentation-service.ts](../src/services/jszip/daa-poc-presentation-service.ts)                                            | Populates `TAB100`, `GGO`, and `TEXT_ME` with demo data. Start here to adapt the report template to real data. |
| [src/services/data-api-client.ts](../src/services/data-api-client.ts)                                                                                  | Fetches and validates upstream JSON; handles API prefixes, bearer tokens, and timeouts.                        |
| [src/pptx/jszip/objects.ts](../src/pptx/jszip/objects.ts)                                                                                              | Locates template objects by Selection Pane name. Check here for missing or duplicate objects.                  |
| [src/pptx/jszip/text/](../src/pptx/jszip/text/), [tables/](../src/pptx/jszip/tables/)                                                                  | Fills text and paragraphs, and fills/resizes tables while retaining formatting.                                |
| [src/pptx/jszip/charts.ts](../src/pptx/jszip/charts.ts)                                                                                                | Updates category-chart caches, formulas, and embedded workbook data together so charts remain editable.        |
| [src/pptx/jszip/spreadsheet.ts](../src/pptx/jszip/spreadsheet.ts)                                                                                      | Writes embedded workbook cells, creating rows/cells and retaining styles.                                      |
| [src/pptx/jszip/package/](../src/pptx/jszip/package/)                                                                                                  | Reads/writes package XML and follows internal relationships between slides, charts, and workbooks.             |
| [templates/business.pptx](../templates/business.pptx), [templates/daa.pptx](../templates/daa.pptx)                                                     | Source decks for placeholder replacement and the report demo. Edit named objects and styling in PowerPoint.    |
| [examples/data-api/single/fetch.ts](../examples/data-api/single/fetch.ts), [src/data-api/report-data-schema.ts](../src/data-api/report-data-schema.ts) | Show upstream data fetching and the expected report data shape.                                                |
| [examples/pdf/webapp.ts](../examples/pdf/webapp.ts), [examples/data-api/server/index.ts](../examples/data-api/server/index.ts)                         | Provide local demo pages and synthetic report data.                                                            |
| [test/](../test/)                                                                                                                                      | Covers HTTP behavior, queues, PDF rendering, upstream data, and generated PowerPoint contents.                 |
| [test/integration/output-routes.ts](../test/integration/output-routes.ts)                                                                              | Produces downloadable sample artifacts for manual inspection via `npm run test:outputs`.                       |
| [scripts/build-azure.mjs](../scripts/build-azure.mjs), [scripts/start-azure.sh](../scripts/start-azure.sh)                                             | Package the app for Azure and start it with its browser runtime.                                               |
| [API endpoints](endpoints.md)                                                                                                                          | Lists endpoint parameters and copyable GET requests.                                                           |
| [Azure deployment](azure.md)                                                                                                                           | Explains Azure deployment and runtime configuration.                                                           |

## Structure and extension

```text
src/
  index.ts                 startup and shutdown
  app.ts                   middleware setup and route registration
  http/                    shared downloads, input parsing, errors, and contracts
  routes/                  folders define URLs; method files define handlers
  config.ts                validated environment configuration
  schemas.ts               runtime validation and inferred input types
  errors.ts                application errors
  queue/generation-queue.ts bounded FIFO queues and admission control
  services/pdf/web-page-pdf.ts          webapp PDF rendering and browser cleanup
  services/pptxgenjs/power-point-generation-service.ts new PPTX decks from slide data
  services/jszip/power-point-template-service.ts   text replacement in existing PPTX files
  services/jszip/daa-poc-presentation-service.ts demo of native tables, charts, and text
  pptx/jszip/                      reusable template XML helpers
  pptx/pptxgenjs/templates/brief.ts       slide design
```

Services are injected into `createApp`, keeping HTTP handling independent from document generation. To add a presentation template, implement the `PresentationTemplate` function type and register it in `PowerPointGenerationService`. It receives a fresh deck and validated input. Add template-specific schemas when new templates need different fields. Add new output formats as separate services and routes.

Both generation endpoints use separate bounded in-memory FIFO queues. `PDF_CONCURRENCY` defaults to 2 active PDF jobs and `PPTX_CONCURRENCY` to 4 active PowerPoint jobs per process. `QUEUE_MAX_PENDING` defaults to 200 waiting jobs **per queue**, in addition to active jobs. The endpoints still return the generated file directly; the HTTP connection stays open while waiting. `QUEUE_WAIT_TIMEOUT_MS` defaults to 120000 and limits waiting time before execution. Full queues and expired waits return 503 with `QUEUE_FULL` or `QUEUE_WAIT_TIMEOUT` and a `Retry-After: 5` header. Waiting jobs are removed when clients disconnect; already active jobs finish and retain their slot until completion. These limits are global per process, not per user. `RENDER_TIMEOUT_MS` defaults to 30000 and covers page navigation, readiness, fonts, and printing after browser setup. Every context closes on success or failure. Shutdown rejects waiting jobs, lets active requests finish, and closes Chromium, with a 15-second shutdown deadline.
