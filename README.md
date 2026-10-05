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

Errors use `{ "error": { "code", "message", "requestId", "details"? } }`. Validation and malformed JSON return 400, unknown endpoints/templates 404, upstream HTTP failures 502, renderer capacity 503, and rendering timeouts 504. Unexpected errors return a generic 500 and are logged with the request ID. JSON requests are limited to 100 KB.

## Structure and extension

```text
src/
  index.ts                 startup and shutdown
  app.ts                   HTTP contracts and centralized errors
  config.ts                validated environment configuration
  schemas.ts               runtime validation and inferred input types
  errors.ts                application errors
  services/pdf.ts          shared browser, isolated contexts, cleanup
  services/presentation.ts template registry and PPTX serialization
  templates/brief.ts       slide design
```

Services are injected into `createApp`, keeping HTTP handling independent from document generation. To add a presentation template, implement the `PresentationTemplate` function type and register it in `PresentationService`. It receives a fresh deck and validated input. Add template-specific schemas when new templates need different fields. Add new output formats as separate services and routes.

PDF rendering reuses one browser and rejects excess work rather than accumulating an unbounded queue. `PDF_CONCURRENCY` defaults to 2. `RENDER_TIMEOUT_MS` defaults to 30000 and covers page navigation, readiness, fonts, and printing after browser setup. Every context closes on success or failure. Shutdown drains HTTP requests and closes Chromium, with a 15-second shutdown deadline.

## Verification and production build

```bash
npm run typecheck
npm test
npm run build
npm start
```

Tests exercise actual Chromium PDF output, query forwarding, timeouts, capacity limits, upstream errors, API validation, and editable PowerPoint XML including speaker notes. `npm start` runs compiled files from `dist`.

This POC is intended for trusted webapps and internal use. Navigation is restricted to the configured origin, but the webapp may fetch external assets and data. Add authentication, request rate limits, network egress controls, and a durable job queue before exposing it publicly or accepting untrusted webapps. Health checks report process availability, not browser readiness. Authenticated report pages need an explicit server-managed authentication strategy.

The `image-size` dependency is overridden to patched version 2.0.3 because PptxGenJS currently requests an older vulnerable range. The included template uses text and shapes; verify image behavior when introducing image templates.

Library references: [Playwright page API](https://playwright.dev/docs/api/class-page#page-pdf), [PptxGenJS saving presentations](https://gitbrent.github.io/PptxGenJS/docs/usage-saving/).
