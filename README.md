# Generator API

A TypeScript + Express proof of concept for generating PDFs from web pages and editable PowerPoint presentations. Requires Node.js 22+.

- **PDF:** Playwright/Chromium renders a page from your configured webapp.
- **PowerPoint:** PptxGenJS generates new decks; JSZip fills existing templates while preserving editable content.
- **HTTP:** validated GET/POST inputs, attachment downloads, request IDs, and bounded generation queues.

## Quick start

Run these commands from the repository root:

```bash
npm ci
npm run browser:install
cp .env.example .env
npm run dev
```

Set `WEBAPP_BASE_URL` in `.env` to your webapp's origin. The API defaults to port 3000. For a local demo webapp on port 3001, run `npm run demo` in another terminal.

Browser installation includes Chromium's system libraries and may require sudo on Linux.

```bash
curl http://localhost:3000/health
curl -X POST http://localhost:3000/api/exports/pdf \
  -H 'Content-Type: application/json' \
  --data-binary @examples/pdf/request.json --output report.pdf
```

## Documentation

| Guide                                             | Contents                                                                      |
| ------------------------------------------------- | ----------------------------------------------------------------------------- |
| [Getting started](docs/getting-started.md)        | Local setup, configuration, Docker access, and sample requests                |
| [API endpoints](docs/endpoints.md)                | Routes, inputs, download examples, responses, and errors                      |
| [Architecture and code map](docs/architecture.md) | File responsibilities, services, routing, queues, and shutdown                |
| [Development](docs/development.md)                | Adding endpoints, imports, tests, hooks, and builds                           |
| [Data API](docs/data-api.md)                      | Upstream configuration, typed responses, single requests, chains, and batches |
| [PDF](docs/pdf.md)                                | Document URLs, IDs, language, and query forwarding                            |
| [PowerPoint](docs/powerpoint.md)                  | File templates, placeholders, the DAA demo, and JSZip utilities               |
| [Azure deployment](docs/azure.md)                 | Packaging, App Service configuration, deployment, and smoke tests             |

All commands in the documentation run from the repository root.

## Where to look

Start with [src/index.ts](src/index.ts) for service wiring and [src/app.ts](src/app.ts) for the HTTP flow. Route handlers live in [src/routes/](src/routes/), generation services in [src/services/](src/services/), and reusable PowerPoint helpers in [src/pptx/](src/pptx/). See the [full code map](docs/architecture.md#where-to-look) for individual files.

Examples live in [examples/](examples/README.md), source presentations in [templates/](templates/), and tests in [test/](test/README.md).

## Verification

```bash
npm run typecheck
npm run knip
npm run templates:preflight
npm test
npm run build
```

This POC is intended for trusted webapps and internal use. See the [runtime limitations](docs/development.md#verification-and-production-build) before deploying publicly.
