# Generator API Documentation

This directory contains technical documentation, developer guides, service manuals, and architectural reviews for Generator API.

## Sectors

### 1. [Architecture](architecture/)

System design, request lifecycle, queue bounds, and simplification roadmaps:

- **[Architecture and code map](architecture/architecture.md):** Overall system design, request flow, queue concurrency, process readiness, and source code map.
- **[Report layer simplification](architecture/report-layer-simplification.md):** Blueprint and plan for streamlining the report abstraction layer, request extraction, and service registration.

---

### 2. [Guides](guides/)

Prerequisites, developer workflows, and HTTP endpoint reference:

- **[Getting started](guides/getting-started.md):** Local setup, environment configuration, Docker container access, and basic requests.
- **[Development](guides/development.md):** Step-by-step guides for adding new PDF and PowerPoint endpoints, coding conventions, and verification commands.
- **[API endpoints](guides/endpoints.md):** Comprehensive reference for all HTTP endpoints, input schemas, download headers, and error codes.

---

### 3. [Services](services/)

Deep dives into document generation and data integration engines:

- **[PDF rendering](services/pdf.md):** Playwright Chromium page-to-PDF rendering, webapp origin restrictions, route patterns, and query forwarding.
- **[PowerPoint generation](services/powerpoint.md):** Template filling via raw OpenXML JSZip manipulation and programmatic slide deck generation with PptxGenJS.
- **[Data API](services/data-api.md):** Upstream API client, response schema validation, LRU response caching, and data fetching workflows.

---

### 4. [Deployment](deployment/)

Cloud hosting, container environments, and CI/CD pipelines:

- **[Azure deployment](deployment/azure.md):** Standalone ZIP packaging for Linux Azure App Service, container CA certificates, and GitLab CI automated pipelines.

---

### 5. [Reviews](reviews/)

Code quality assessments, historical audits, and improvement roadmaps:

- **[Code review](reviews/code-review.md):** Thorough audit covering startup, routing, HTTP handling, document generation, and deployment tooling.
- **[Project review](reviews/project-review.md):** Fix status and regression tracking for browser redirection, character validation, and queue control.
- **[Project improvements](reviews/project-improvements.md):** Catalog of identified over-engineering, test coverage notes, and simplification proposals.
