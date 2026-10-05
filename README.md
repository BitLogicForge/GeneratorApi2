# Generator API

A TypeScript + Express proof of concept for exporting a webapp route to PDF and generating editable PowerPoint presentations. Node.js 22+ required.

## Run

```bash
npm ci
npm run browser:install
cp .env.example .env
npm run dev
```

On minimal Linux installations, run `npx playwright install-deps chromium` once to install browser system libraries.

Set `WEBAPP_BASE_URL` to your webapp's origin. The API defaults to port 3000 and the webapp to port 3001. For a complete local demo, run `npm run demo` in another terminal.

```bash
curl http://localhost:3000/health
curl -X POST http://localhost:3000/api/pdf \
  -H 'Content-Type: application/json' \
  --data-binary @examples/pdf.json --output report.pdf
curl -X POST http://localhost:3000/api/presentations/brief \
  -H 'Content-Type: application/json' \
  --data-binary @examples/presentation.json --output presentation.pptx
```

## Endpoints

| Endpoint | Input | Result |
| --- | --- | --- |
| `POST /api/pdf` | Relative `route`, optional `query`, `filename`, `waitForSelector`, `format`, `landscape` | PDF attachment |
| `POST /api/presentations/:template` | Template in route; `title`, `slides`, optional `subtitle`, `author`, `accent`, `filename` in JSON | Editable PPTX attachment |
| `GET /health` | None | Process health |

PowerPoint's `brief` template creates a dark cover and light numbered content slides. Each slide takes `title`, 1–6 `bullets`, and optional speaker `notes`. Accent is a six-digit hex color without `#`. Up to 30 content slides are supported. Filenames omit extensions and accept letters, numbers, underscores, and hyphens.

The PDF endpoint combines the route with the configured origin. Query values may be strings, numbers, or booleans. It prints with background colors, A4 by default, and 12 mm margins. Use a visible readiness marker such as `[data-report-ready]` for asynchronously loaded reports. Your webapp controls print layout through `@media print`. Browser cookies and authentication are isolated per request; caller credentials are not forwarded.

Errors use `{ "error": { "code", "message", "requestId", "details"? } }`. Validation and malformed JSON return 400, unknown endpoints/templates 404, upstream HTTP failures 502, queue capacity/wait timeout 503, and rendering timeouts 504. Unexpected errors return a generic 500 and are logged with the request ID. JSON requests are limited to 100 KB.

## Structure and extension

```text
src/
  index.ts                 startup and shutdown
  app.ts                   HTTP contracts and centralized errors
  config.ts                validated environment configuration
  schemas.ts               runtime validation and inferred input types
  errors.ts                application errors
  queue/generation-queue.ts bounded FIFO queues and admission control
  services/pdf.ts          shared browser, isolated contexts, cleanup
  services/presentation.ts template registry and PPTX serialization
  templates/brief.ts       slide design
```

Services are injected into `createApp`, keeping HTTP handling independent from document generation. To add a presentation template, implement the `PresentationTemplate` function type and register it in `PresentationService`. It receives a fresh deck and validated input. Add template-specific schemas when new templates need different fields. Add new output formats as separate services and routes.

Both generation endpoints use separate bounded in-memory FIFO queues. `PDF_CONCURRENCY` defaults to 2 active PDF jobs and `PPTX_CONCURRENCY` to 4 active PowerPoint jobs per process. `QUEUE_MAX_PENDING` defaults to 200 waiting jobs **per queue**, in addition to active jobs. The endpoints still return the generated file directly; the HTTP connection stays open while waiting. `QUEUE_WAIT_TIMEOUT_MS` defaults to 120000 and limits waiting time before execution. Full queues and expired waits return 503 with `QUEUE_FULL` or `QUEUE_WAIT_TIMEOUT` and a `Retry-After: 5` header. Waiting jobs are removed when clients disconnect; already active jobs finish and retain their slot until completion. These limits are global per process, not per user. `RENDER_TIMEOUT_MS` defaults to 30000 and covers page navigation, readiness, fonts, and printing after browser setup. Every context closes on success or failure. Shutdown rejects waiting jobs, lets active requests finish, and closes Chromium, with a 15-second shutdown deadline.

## Verification and production build

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

## Edit an existing PowerPoint template

`POST /api/presentation-templates/:template` reads a registered `.pptx` file and modifies its text directly. The included `business` template is `templates/business.pptx`.

```bash
curl -X POST http://localhost:3000/api/presentation-templates/business \
  -H 'Content-Type: application/json' \
  --data-binary @examples/template-presentation.json --output proposal.pptx
```

In PowerPoint, add placeholders such as `{{title}}`, `{{subtitle}}`, and `{{customer}}` to text boxes or table cells. Supply matching strings in the JSON `replacements` object. Placeholders can span formatting runs within a paragraph; replacement text inherits the formatting of the first run. Speaker-note placeholders are also replaced. Replacements are literal text, with XML characters escaped automatically. Missing replacements and unknown keys return 400, so spelling errors do not silently produce incomplete decks.

Register your own files in `src/index.ts` when constructing `TemplatePresentationService`. The registry accepts trusted server-side paths; callers select a template name and cannot supply filesystem paths. Include the `templates` directory beside `dist` in your deployment. Each request loads a fresh copy and never changes the original template. The included sample can be recreated with `npx tsx examples/create-template.ts`.

Only slide and speaker-note text is changed. Untouched ZIP parts, including media, masters, layouts, charts, and relationships, are preserved. This endpoint supports modern `.pptx`, not legacy `.ppt`. Placeholders in masters, layouts, chart data, or across paragraphs are not supported. Replacement strings are single-paragraph text; layout and text-box sizing remain the template author's responsibility. This initial manipulation service does not resize images, update chart data, or add/remove slides. It shares the existing PowerPoint queue and concurrency limit.

## PDF download URLs

`GET /:id.pdf` provides a direct download link such as `https://generator-host/id2222.pdf`. Configure the other webapp host and its document route in Azure application settings (or `.env` locally):

```dotenv
WEBAPP_BASE_URL=https://other-host.example
PDF_ROUTE_PATTERN=/document?id={id}
```

With these settings, `https://generator-host/id2222.pdf?language=en` renders `https://other-host.example/document?id=id2222&language=en` and returns an `id2222.pdf` attachment. For path-based webapps, use `PDF_ROUTE_PATTERN=/documents/{id}` (the default). Additional query parameters are forwarded as strings. Query keys already configured in the pattern cannot be overridden by the caller. Duplicate query keys are rejected. IDs accept up to 80 letters, numbers, underscores, and hyphens.

The GET endpoint uses the same PDF queue and rendering settings as `POST /api/pdf`. It does not cache documents or forward client cookies. The POST endpoint remains available for per-request readiness selectors and print options. For the included demo, start both servers and open `http://localhost:3000/id2222.pdf`.
