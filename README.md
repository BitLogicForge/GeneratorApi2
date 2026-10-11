# Generator API

A TypeScript + Express proof of concept for exporting a webapp route to PDF and generating editable PowerPoint presentations. Node.js 22+ required.

## Where to look

Start with `src/index.ts` for service wiring, then `src/app.ts` for the HTTP flow. Use this guide to find the code for a specific change.

| File                                                                                                                             | Purpose / when to look here                                                                                    |
| -------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| [src/index.ts](src/index.ts)                                                                                                     | Starts the server, registers template files, wires services and queues, and handles shutdown.                  |
| [src/app.ts](src/app.ts)                                                                                                         | Sets up middleware, request IDs, routers, and error handling.                                                  |
| [src/config.ts](src/config.ts)                                                                                                   | Defines document route/language defaults and validates environment settings and runtime limits.                |
| [src/schemas.ts](src/schemas.ts)                                                                                                 | Defines accepted export inputs, validation rules, and inferred TypeScript types.                               |
| [src/pdf-route.ts](src/pdf-route.ts)                                                                                             | Validates document IDs and route patterns; expands `{id}` for direct PDF links.                                |
| [src/routes/health.ts](src/routes/health.ts)                                                                                     | Handles `GET /health`.                                                                                         |
| [src/routes/document-pdf.ts](src/routes/document-pdf.ts)                                                                         | Handles `GET /:id.pdf`.                                                                                        |
| [src/routes/export-pdf.ts](src/routes/export-pdf.ts)                                                                             | Handles `GET/POST /api/exports/pdf`.                                                                           |
| [src/routes/demo-report.ts](src/routes/demo-report.ts)                                                                           | Handles `GET /demo-report.pptx`.                                                                               |
| [src/routes/generated-presentation.ts](src/routes/generated-presentation.ts)                                                     | Handles `GET/POST /api/exports/pptx/generated/:template`.                                                      |
| [src/routes/template-presentation.ts](src/routes/template-presentation.ts)                                                       | Handles `GET/POST /api/exports/pptx/templates/:template`.                                                      |
| [src/http/types.ts](src/http/types.ts)                                                                                           | Declares injectable service contracts. Update these when wiring a new service into routes.                     |
| [src/http/input.ts](src/http/input.ts)                                                                                           | Converts GET query fields into export inputs. Add decoding here for new structured query fields.               |
| [src/http/download.ts](src/http/download.ts)                                                                                     | Queues generation, cancels waiting work on disconnect, and sends file attachments.                             |
| [src/http/error-handler.ts](src/http/error-handler.ts), [src/errors.ts](src/errors.ts)                                           | Define application errors and translate failures into HTTP responses and logs.                                 |
| [src/queue/generation-queue.ts](src/queue/generation-queue.ts)                                                                   | Controls concurrency, pending capacity, wait timeouts, cancellation, and shutdown admission.                   |
| [src/services/web-page-pdf.ts](src/services/web-page-pdf.ts)                                                                     | Manages Chromium, navigation restrictions, page readiness, printing, and browser context cleanup.              |
| [src/pptx/pptxgenjs/generated-presentation.ts](src/pptx/pptxgenjs/generated-presentation.ts)                                     | Registers code-based presentation designs and creates a fresh deck for each export.                            |
| [src/pptx/pptxgenjs/templates/brief.ts](src/pptx/pptxgenjs/templates/brief.ts)                                                   | Defines the brief deck's slide layout, typography, colors, and speaker notes. Change its visual design here.   |
| [src/pptx/jszip/powerpoint-template.ts](src/pptx/jszip/powerpoint-template.ts)                                                   | Replaces `{{tokens}}` in existing slide and note text, including tokens split across formatting runs.          |
| [src/pptx/jszip/template-report-demo.ts](src/pptx/jszip/template-report-demo.ts)                                                 | Populates `TAB100`, `GGO`, and `TEXT_ME` with demo data. Start here to adapt the report template to real data. |
| [src/services/data-api-client.ts](src/services/data-api-client.ts)                                                               | Fetches and validates upstream JSON; handles API prefixes, bearer tokens, and timeouts.                        |
| [src/pptx/jszip/objects.ts](src/pptx/jszip/objects.ts)                                                                           | Locates template objects by Selection Pane name. Check here for missing or duplicate objects.                  |
| [src/pptx/jszip/text-table.ts](src/pptx/jszip/text-table.ts)                                                                     | Fills text shapes and fixed-size tables while retaining formatting.                                            |
| [src/pptx/jszip/charts.ts](src/pptx/jszip/charts.ts)                                                                             | Updates line-chart caches, formulas, and embedded workbook data together so charts remain editable.            |
| [src/pptx/jszip/spreadsheet.ts](src/pptx/jszip/spreadsheet.ts)                                                                   | Writes embedded workbook cells, creating rows/cells and retaining styles.                                      |
| [src/pptx/jszip/package.ts](src/pptx/jszip/package.ts)                                                                           | Reads/writes package XML and follows internal relationships between slides, charts, and workbooks.             |
| [templates/business.pptx](templates/business.pptx), [templates/daa.pptx](templates/daa.pptx)                                     | Source decks for placeholder replacement and the report demo. Edit named objects and styling in PowerPoint.    |
| [examples/fetch-report-data.ts](examples/fetch-report-data.ts), [examples/report-data-schema.ts](examples/report-data-schema.ts) | Show upstream data fetching and the expected report data shape.                                                |
| [examples/webapp.ts](examples/webapp.ts), [examples/data-api.ts](examples/data-api.ts)                                           | Provide local demo pages and synthetic report data.                                                            |
| [test/](test/)                                                                                                                   | Covers HTTP behavior, queues, PDF rendering, upstream data, and generated PowerPoint contents.                 |
| [test/output-routes.ts](test/output-routes.ts)                                                                                   | Produces downloadable sample artifacts for manual inspection via `npm run test:outputs`.                       |
| [scripts/build-azure.mjs](scripts/build-azure.mjs), [scripts/start-azure.sh](scripts/start-azure.sh)                             | Package the app for Azure and start it with its browser runtime.                                               |
| [README-ENDPOINTS.md](README-ENDPOINTS.md)                                                                                       | Lists endpoint parameters and copyable GET requests.                                                           |
| [AZURE.md](AZURE.md)                                                                                                             | Explains Azure deployment and runtime configuration.                                                           |

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
curl -X POST http://localhost:3000/api/exports/pdf \
  -H 'Content-Type: application/json' \
  --data-binary @examples/pdf.json --output report.pdf
curl -X POST http://localhost:3000/api/exports/pptx/generated/brief \
  -H 'Content-Type: application/json' \
  --data-binary @examples/presentation.json --output presentation.pptx
```

## Access from outside Docker

Set the API listening address in `.env`:

```dotenv
HOST=0.0.0.0
PORT=3000
```

`HOST` defaults to `0.0.0.0` so the API accepts connections through the container's network interface. The devcontainer publishes container port 3000 to `127.0.0.1:3000` on your computer. Rebuild the devcontainer after changing its port configuration, then start the API with `npm run dev` and test from a terminal outside Docker:

```bash
curl http://localhost:3000/health
```

For a container started manually, use `docker run -p 127.0.0.1:3000:3000 ...`. If you change `PORT`, change the Docker port mapping to match. To connect from another computer, publish to the host's network interface (for example `-p 3000:3000`) and use `http://<docker-host-ip>:3000`.

`WEBAPP_BASE_URL` is the address Chromium uses from inside the container. If your webapp runs on your computer rather than in the container, configure an address reachable from Docker, such as `http://host.docker.internal:3001` on Docker Desktop. On Linux Docker Engine, add `--add-host=host.docker.internal:host-gateway`; the webapp must listen on an interface reachable from Docker.

## Endpoints

All generation endpoints also support GET with query parameters. See [GET endpoint examples](README-ENDPOINTS.md) for every endpoint and copyable requests. Text fields are query strings; `query`, `slides`, and `replacements` contain URL-encoded JSON, and `landscape` is `true` or `false`. Existing POST requests remain supported.

| Endpoint                                     | Input                                                                                             | Result                   |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------ |
| `POST /api/exports/pdf`                      | Relative `route`, optional `query`, `filename`, `waitForSelector`, `format`, `landscape`          | PDF attachment           |
| `POST /api/exports/pptx/generated/:template` | Template in route; `title`, `slides`, optional `subtitle`, `author`, `accent`, `filename` in JSON | Editable PPTX attachment |
| `GET /health`                                | None                                                                                              | Process health           |

PowerPoint's `brief` template creates a dark cover and light numbered content slides. Each slide takes `title`, 1–6 `bullets`, and optional speaker `notes`. Accent is a six-digit hex color without `#`. Up to 30 content slides are supported. Filenames omit extensions and accept letters, numbers, underscores, and hyphens.

The PDF endpoint combines the route with the configured origin. Query values may be strings, numbers, or booleans. It prints with background colors, A4 by default, and 12 mm margins. Use a visible readiness marker such as `[data-report-ready]` for asynchronously loaded reports. Your webapp controls print layout through `@media print`. Browser cookies and authentication are isolated per request; caller credentials are not forwarded.

Errors use `{ "error": { "code", "message", "requestId", "details"? } }`. Validation and malformed JSON return 400, unknown endpoints/templates 404, upstream HTTP failures 502, queue capacity/wait timeout 503, and rendering timeouts 504. Unexpected errors return a generic 500 and are logged with the request ID. JSON requests are limited to 100 KB.

## Fetch report data from another API

`DataApiClient` coordinates helpers in `src/services/data-api/`: `url.ts` validates paths and encodes queries; `request.ts` fetches JSON, applies the timeout, and validates responses.

The optional `DataApiClient` uses `config.dataApi` from `src/config.ts`:

```dotenv
DATA_API_BASE_URL=http://localhost:3002/api
DATA_API_TOKEN=
DATA_API_TIMEOUT_MS=10000
```

Set the base URL to your API, including its path prefix. A nonempty token is sent as a bearer token. The timeout covers fetching and reading the response. Leaving the base URL unset keeps this feature unconfigured without affecting document exports.

Run the local example in two terminals:

```bash
# Terminal 1: start the synthetic data API
npm run demo:data-api
```

```bash
# Terminal 2: fetch by document ID, language, and year
DATA_API_BASE_URL=http://localhost:3002/api npm run example:fetch-data -- id2222 en 2026
```

This calls `/api/reports/id2222?language=en&year=2026` and saves `output/data-api/id2222.json`. If the settings are already in `.env`, omit the inline environment variable. The example defaults to `id2222`, the configured language, and year 2026 when arguments are omitted.

Use the client in a service like this:

```ts
const api = new DataApiClient(config.dataApi);
const data = await api.get(
  `/reports/${encodeURIComponent(id)}`,
  { language: 'en', year: 2026 },
  reportDataSchema,
);
```

See `examples/fetch-report-data.ts` for imports and complete usage. Query values can be strings, numbers, booleans, or `undefined` (omitted); they are URL-encoded automatically. Adapt `examples/report-data-schema.ts` to your API's response. The example returns three table rows, twenty chart rows, and category labels, ready for the existing template helpers. Current demo exports continue using random numbers; fetching is available as a separate example for the future integration.

The client preserves the configured URL prefix, rejects paths outside it, and does not follow redirects. HTTP failures, connection failures, invalid JSON, and invalid response data become 502 errors; timeouts become 504 errors.

When the API is on your computer and Generator API runs in Docker, use a Docker-reachable hostname such as `host.docker.internal`, as described above for `WEBAPP_BASE_URL`.

PptxGenJS deck generation and designs live in `src/pptx/pptxgenjs/`. JSZip template editing and XML helpers live in `src/pptx/jszip/`; `placeholders.ts` handles text tokens independently of template registration and file loading.

## Structure and extension

```text
src/
  index.ts                 startup and shutdown
  app.ts                   middleware setup and route registration
  http/                    shared downloads, input parsing, errors, and contracts
  routes/                  one module per endpoint path
  config.ts                validated environment configuration
  schemas.ts               runtime validation and inferred input types
  errors.ts                application errors
  queue/generation-queue.ts bounded FIFO queues and admission control
  services/web-page-pdf.ts          webapp PDF rendering and browser cleanup
  pptx/pptxgenjs/generated-presentation.ts new PPTX decks from slide data
  pptx/jszip/powerpoint-template.ts   text replacement in existing PPTX files
  pptx/jszip/template-report-demo.ts demo of native tables, charts, and text
  pptx/jszip/                      reusable template XML helpers
  pptx/pptxgenjs/templates/brief.ts       slide design
```

Services are injected into `createApp`, keeping HTTP handling independent from document generation. To add a presentation template, implement the `PresentationTemplate` function type and register it in `GeneratedPresentationService`. It receives a fresh deck and validated input. Add template-specific schemas when new templates need different fields. Add new output formats as separate services and routes.

Both generation endpoints use separate bounded in-memory FIFO queues. `PDF_CONCURRENCY` defaults to 2 active PDF jobs and `PPTX_CONCURRENCY` to 4 active PowerPoint jobs per process. `QUEUE_MAX_PENDING` defaults to 200 waiting jobs **per queue**, in addition to active jobs. The endpoints still return the generated file directly; the HTTP connection stays open while waiting. `QUEUE_WAIT_TIMEOUT_MS` defaults to 120000 and limits waiting time before execution. Full queues and expired waits return 503 with `QUEUE_FULL` or `QUEUE_WAIT_TIMEOUT` and a `Retry-After: 5` header. Waiting jobs are removed when clients disconnect; already active jobs finish and retain their slot until completion. These limits are global per process, not per user. `RENDER_TIMEOUT_MS` defaults to 30000 and covers page navigation, readiness, fonts, and printing after browser setup. Every context closes on success or failure. Shutdown rejects waiting jobs, lets active requests finish, and closes Chromium, with a 15-second shutdown deadline.

## Add a new endpoint: step-by-step

The example below adds `GET /sales-report.pptx?title=Quarterly%20sales`. It reuses the current report-demo template so you can start with a working download, then replace the service's data generation with your own API calls. These are instructions for adding a future endpoint; `/sales-report.pptx` is not registered yet.

### 1. Define the request schema

Add this to `src/schemas.ts`, which already imports `z`:

```ts
export const salesReportSchema = z
  .object({ title: z.string().min(1).max(5000).default('Sales report') })
  .strict();

export type SalesReportInput = z.infer<typeof salesReportSchema>;
```

Give optional parameters defaults so the URL also works without a query string. `.strict()` rejects misspelled or unknown parameters. Keep application defaults in `src/config.ts`; use environment settings for hosts, credentials, and runtime limits.

### 2. Add the generation service

Create `src/pptx/jszip/sales-report.ts`:

```ts
import type { SalesReportInput } from '../../schemas.js';
import { TemplateReportDemoService } from './template-report-demo.js';

export class SalesReportService {
  private readonly template: TemplateReportDemoService;

  constructor(templatePath: string) {
    this.template = new TemplateReportDemoService(templatePath);
  }

  generate(input: SalesReportInput): Promise<Buffer> {
    return this.template.generate(input.title);
  }
}
```

This starting implementation puts `title` into `TEXT_ME` and uses the existing random table/chart data. For your real report, fetch data with `DataApiClient` and use the `src/pptx/jszip` helpers to populate named objects. Keep Express requests and responses out of the service; return the finished file as a `Buffer`.

### 3. Declare the dependency

In `src/http/types.ts`, add `SalesReportInput` to the existing import from `../schemas.js`, then add this property inside `AppOptions`:

```ts
salesReport?: { generate(input: SalesReportInput): Promise<Buffer> };
```

`RouteDependencies` inherits it automatically. Making the dependency optional lets unrelated route tests continue using their existing fixtures; the route below returns 404 when it is not configured.

### 4. Wire the service at startup

Import the service in `src/index.ts`:

```ts
import { SalesReportService } from './pptx/jszip/sales-report.js';
```

Add this property to the existing `createApp({ ... })` call:

```ts
salesReport: new SalesReportService(
  fileURLToPath(new URL('../templates/daa.pptx', import.meta.url)),
),
```

For a different template, place its `.pptx` in the root `templates/` directory and use that path. The Azure build includes those files. Match its object names and chart/table structure to your service.

### 5. Register the route

Create `src/routes/sales-report.ts` with a router factory:

```ts
import { Router } from 'express';
import type { RouteDependencies } from '../http/types.js';
import { salesReportSchema } from '../schemas.js';
import { AppError } from '../errors.js';
import { sendDownload } from '../http/download.js';

export function createSalesReportRoute({
  salesReport,
  queues,
}: RouteDependencies) {
  const router = Router();
  router.get('/sales-report.pptx', async (req, res) => {
    const input = salesReportSchema.parse(req.query);
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
  });
  return router;
}
```

The download helper handles queuing, disconnected clients, filename extensions, content type, and attachment headers. Use `queues.pdf` and format `'pdf'` for PDF downloads. For a JSON endpoint, validate the input and use `res.json(data)` instead.

For a route supporting both GET query parameters and POST JSON, use `generationInput(req)` before schema validation and register the same handler with `.get(handler).post(handler)`. Its supported JSON query fields are currently `query`, `slides`, `replacements`, and `landscape`; explicitly decode any new nested query fields you introduce.

Import `createSalesReportRoute` in `src/app.ts` and register it with `app.use(createSalesReportRoute(dependencies))` before the 404 handler and error middleware. Keep each endpoint path in its own route module.

### 6. Test and document it

Add a `test/sales-report.test.ts` using `createApp` and Supertest, following `test/template-report-demo.test.ts`. Cover a successful download, the default title, a custom title, invalid parameters, and generation failures. Check that the PPTX contains the supplied text, rather than only checking HTTP 200.

Add a file-producing case to `test/output-routes.ts`: configure `salesReport` in its `createApp` fixture and call `save('/sales-report.pptx?title=Sales%20demo', 'sales-report.pptx', 'Sales demo')` inside a subtest. Add the endpoint, accepted parameters, and a request example to `README-ENDPOINTS.md`.

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

## Verification and production build

Use `npm run deps:check` to preview dependency updates within the declared version ranges. Use `npm run deps:update` to apply them with npm-check-updates doctor mode, which checks types, Knip, and tests to identify failing upgrades. Commit or stash existing changes first; PDF tests require Chromium (`npm run browser:install`).

Run `npm run knip` to find unused files, exports, and dependencies. Knip analyzes source code, tests, examples, and build scripts; its configuration lives in `knip.json`. The GitLab build runs this check before packaging the app.

For Linux Azure App Service, run `npm run build:azure` to create `output/azure/generator-api.zip`, then `npm run test:azure` to smoke-test the package. See [AZURE.md](AZURE.md) for startup and deployment settings.

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

## Edit an existing PowerPoint template

`POST /api/exports/pptx/templates/:template` reads a registered `.pptx` file and modifies its text directly. The included `business` template is `templates/business.pptx`.

```bash
curl -X POST http://localhost:3000/api/exports/pptx/templates/business \
  -H 'Content-Type: application/json' \
  --data-binary @examples/template-presentation.json --output proposal.pptx
```

In PowerPoint, add placeholders such as `{{title}}`, `{{subtitle}}`, and `{{customer}}` to text boxes or table cells. Supply matching strings in the JSON `replacements` object. Placeholders can span formatting runs within a paragraph; replacement text inherits the formatting of the first run. Speaker-note placeholders are also replaced. Replacements are literal text, with XML characters escaped automatically. Missing replacements and unknown keys return 400, so spelling errors do not silently produce incomplete decks.

Register your own files in `src/index.ts` when constructing `PowerPointTemplateService`. The registry accepts trusted server-side paths; callers select a template name and cannot supply filesystem paths. Include the `templates` directory beside `dist` in your deployment. Each request loads a fresh copy and never changes the original template. The included sample can be recreated with `npx tsx examples/create-template.ts`.

Only slide and speaker-note text is changed. Untouched ZIP parts, including media, masters, layouts, charts, and relationships, are preserved. This endpoint supports modern `.pptx`, not legacy `.ppt`. Placeholders in masters, layouts, chart data, or across paragraphs are not supported. Replacement strings are single-paragraph text; layout and text-box sizing remain the template author's responsibility. This initial manipulation service does not resize images, update chart data, or add/remove slides. It shares the existing PowerPoint queue and concurrency limit.

## Template report demo

Open `http://localhost:3000/demo-report.pptx` to download `templates/daa.pptx` populated with random integers from 1–100. No parameters are required. The objects are found by their Selection Pane names: `TAB100` (table), `GGO` (chart), and `TEXT_ME` (text). Set the text with `http://localhost:3000/demo-report.pptx?TEXT_ME=Hello%20world`; omitting `TEXT_ME` uses `Generated report`. The value accepts up to 5,000 characters and is inserted as literal text, preserving the first text run’s formatting. Object names must be unique across the presentation. The chart and embedded workbook are located through their relationships, so object order and chart filenames may change. The table must remain 4×4 and the chart must retain its three-series data layout. The first table row stays unchanged as the header; only the last three rows receive random values. The line chart receives a separate set of 20 random rows across three series, with category labels `A1`–`A20`. Series names and template styling stay as authored. The embedded Excel workbook and chart cache are updated together, keeping **Edit Data** available in PowerPoint. The source file remains unchanged, and generation shares the PowerPoint queue.

Run `npm run test:outputs` to save a sample to `output/routes/demo-report.pptx` along with the other route outputs.

Reusable template helpers live in `src/pptx/jszip`: `objects.ts` finds uniquely named shapes across slides; `text-table.ts` fills text and tables; `charts.ts` synchronizes line-chart values with their embedded workbook; `package.ts` reads/writes XML parts and resolves file relationships. `TemplateReportDemoService` supplies the object names and random data, then calls these helpers. The chart helper resizes numeric ranges (default `Sheet1`, starting at `B2`), chart caches, worksheet rows, and the embedded Excel table range. Pass `categories` when changing the number of rows; series count must match the template. Series names and styles are preserved.

## PDF download URLs

Query parameters are optional. `/id2222.pdf` uses `documentSettings.defaultLanguage` (`en` by default), configured in `src/config.ts`; `/id2222.pdf?language=de` overrides it. A language already set in `documentSettings.pdfRoutePattern` stays authoritative. Other omitted query parameters use your webapp's defaults.

`GET /:id.pdf` provides a direct download link such as `https://generator-host/id2222.pdf`. Configure the webapp host in Azure application settings (or `.env` locally) and the document route in `src/config.ts`:

```dotenv
WEBAPP_BASE_URL=https://other-host.example
```

In `src/config.ts`:

```ts
export const documentSettings = {
  defaultLanguage: 'en',
  pdfRoutePattern: '/document?id={id}',
};
```

With these settings, `https://generator-host/id2222.pdf?language=en` renders `https://other-host.example/document?id=id2222&language=en` and returns an `id2222.pdf` attachment. For path-based webapps, use `pdfRoutePattern: '/documents/{id}'` in `src/config.ts` (the default). Additional query parameters are forwarded as strings. Query keys already configured in the pattern cannot be overridden by the caller. Duplicate query keys are rejected. IDs accept up to 80 letters, numbers, underscores, and hyphens.

The GET endpoint uses the same PDF queue and rendering settings as `POST /api/exports/pdf`. It does not cache documents or forward client cookies. The POST endpoint remains available for per-request readiness selectors and print options. For the included demo, start both servers and open `http://localhost:3000/id2222.pdf`.
