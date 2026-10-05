# Generator API

A simple Express API that creates PDFs from web pages and editable PowerPoint files. Inputs, configuration, API responses, and templates are assumed to be correct. There are no tests or runtime validation layers. Requests generate files directly.

## Run locally

```bash
npm install
npm run browser:install
cp .env.example .env
npm run demo
```

In another terminal:

```bash
npm run dev
```

The API listens on port 3000 and the demo webapp on port 3001. `HOST` defaults to `0.0.0.0` for container access. The devcontainer publishes port 3000 to your computer’s localhost.

## Configuration

Set environment values in `.env`:

| Variable            | Default               |
| ------------------- | --------------------- |
| HOST                | 0.0.0.0               |
| PORT                | 3000                  |
| WEBAPP_BASE_URL     | http://localhost:3001 |
| RENDER_TIMEOUT_MS   | 30000                 |
| DATA_API_BASE_URL   | Empty                 |
| DATA_API_TOKEN      | Empty                 |
| DATA_API_TIMEOUT_MS | 10000                 |

Edit `documentSettings` in `src/config.ts` to change the default language (`en`) or PDF route pattern (`/documents/{id}`).

## Document generation

See [endpoint examples](README-ENDPOINTS.md) for requests.

- `src/routes/` connects HTTP requests to generation services.
- `src/types.ts` contains plain TypeScript input types.
- `src/services/web-page-pdf.ts` renders pages with Chromium.
- `src/templates/brief.ts` builds slides with PptxGenJS.
- `src/services/powerpoint-template.ts` replaces `{{placeholder}}` text in slides and speaker notes.
- `src/pptx/` edits native tables, charts, and embedded Excel data.

Register generated templates in `GeneratedPresentationService` and PPTX file templates in `src/index.ts`. The included `business.pptx` uses `title`, `subtitle`, and `customer` replacements.

The `/demo-report.pptx` endpoint fills the `TAB100` table, `GGO` chart, and `TEXT_ME` text shape in `templates/daa.pptx`. It preserves the table header and fills three rows of four values. The chart gets 20 rows of three values, with editable workbook data.

## External data API example

```bash
npm run demo:data-api
```

Then, in another terminal:

```bash
npm run example:fetch-data -- id2222 en 2026
```

`DataApiClient.get<T>(path, query)` fetches JSON directly. Describe the expected response with a TypeScript interface, as in `examples/report-data.ts`. The example saves data to `output/data-api/`.

## Build and deploy

```bash
npm run build
npm start
```

`npm run typecheck` checks source and example compilation. `npm run format` formats the project.

For Azure, run `npm run build:azure` and follow [AZURE.md](AZURE.md).
