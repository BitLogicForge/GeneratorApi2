# Generator API Documentation

Technical reference for developers and AI agents working on Generator API.

## Sections

- **[Architecture](architecture/architecture.md)**: Request pipeline, report
  definitions (`definePdfReport`, `definePptxReport`), `ReportServices`
  lifecycle, configuration assembly, and bounded admission queues.
- **[Getting Started](guides/getting-started.md)**: Environment setup, Chromium
  installation, Docker host networking, and sample requests.
- **[Development](guides/development.md)**: Recipes for adding PDF and
  PowerPoint endpoints, URL/query mapping, import rules, and verification
  commands.
- **[API Endpoints](guides/endpoints.md)**: HTTP routes, query/body schemas,
  download headers, error responses, and runnable examples.
- **[PDF Service](services/pdf.md)**: Playwright Chromium rendering, origin
  navigation boundaries, readiness selectors, and print overrides.
- **[PowerPoint Service](services/powerpoint.md)**: PptxGenJS deck generation,
  placeholder replacement, and JSZip OpenXML utilities (`src/pptx/jszip/`).
- **[Data API Service](services/data-api.md)**: `DataApiClient`, endpoint
  registry (`src/data-api/endpoints.ts`), LRU caching, and example workflows.
- **[Azure Deployment](deployment/azure.md)**: Linux App Service ZIP packaging,
  CA certificate collection, and GitLab CI pipeline stages.
- **[PowerPoint Roadmap](roadmap/powerpoint.md)**: Prioritized ideas for
  extending PPTX generation (images, paginated tables, conditional slides,
  charts, rich text).
- **[Project Review](review/project-review.md)**: Code review findings with
  severity, fix status, and suggested order of work.
