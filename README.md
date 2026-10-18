# Generator API

Node.js 22+ TypeScript and Express service for rendering webapp pages to PDF
(Playwright) and generating editable PowerPoint presentations (PptxGenJS and
JSZip).

## Quick Start

```bash
npm ci
npm run browser:install
cp .env.example .env
npm run dev
```

For PDF routes that render local demo pages on port `3001`, start the demo
webapp in a second terminal with `npm run demo`.

```bash
curl http://localhost:3000/health
curl http://localhost:3000/internal/ready
curl http://localhost:3000/internal/metrics
curl --fail-with-body http://localhost:3000/pptx/daa -o demo-report.pptx
curl -X POST http://localhost:3000/pptxgenjs/brief \
  -H 'Content-Type: application/json' \
  --data-binary @examples/pptx/generated.json -o brief.pptx
```

## Documentation

| Guide                                             | Purpose                                                           |
| ------------------------------------------------- | ----------------------------------------------------------------- |
| [Documentation Index](docs/README.md)             | Overview of all documentation sections                            |
| [Architecture](docs/architecture/architecture.md) | Request lifecycle, service registry, queues, and code map         |
| [Getting Started](docs/guides/getting-started.md) | Local setup, `.env` variables, and Docker networking              |
| [Development](docs/guides/development.md)         | Adding PDF/PPTX endpoints, URL mapping, and static checks         |
| [API Endpoints](docs/guides/endpoints.md)         | Complete route contracts, parameters, error codes, and `curl`     |
| [PDF Service](docs/services/pdf.md)               | Chromium lifecycle, origin boundaries, readiness, print settings  |
| [PowerPoint Service](docs/services/powerpoint.md) | PptxGenJS, template services, and JSZip OpenXML utilities         |
| [Data API Service](docs/services/data-api.md)     | Typed upstream client, LRU cache, and single/chain/batch examples |
| [Azure Deployment](docs/deployment/azure.md)      | Standalone ZIP packaging, startup script, and GitLab CI           |
