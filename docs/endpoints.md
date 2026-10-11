# API endpoints

[Back to overview](../README.md)

## Overview

All generation endpoints also support GET with query parameters. See [GET endpoint examples](endpoints.md) for every endpoint and copyable requests. Text fields are query strings; `query`, `slides`, and `replacements` contain URL-encoded JSON, and `landscape` is `true` or `false`. Existing POST requests remain supported.

| Endpoint                                 | Input                                                                                              | Result                   |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------ |
| `POST /api/exports/pdf`                  | Relative `route`, optional `query`, `filename`, `waitForSelector`, `format`, `landscape`           | PDF attachment           |
| `POST /api/exports/pptx/pptxgenjs/brief` | Fixed brief design; `title`, `slides`, optional `subtitle`, `author`, `accent`, `filename` in JSON | Editable PPTX attachment |
| `GET /health`                            | None                                                                                               | Process health           |

PowerPoint's `brief` template creates a dark cover and light numbered content slides. Each slide takes `title`, 1–6 `bullets`, and optional speaker `notes`. Accent is a six-digit hex color without `#`. Up to 30 content slides are supported. Filenames omit extensions and accept letters, numbers, underscores, and hyphens.

The PDF endpoint combines the route with the configured origin. Query values may be strings, numbers, or booleans. It prints with background colors, A4 by default, and 12 mm margins. Use a visible readiness marker such as `[data-report-ready]` for asynchronously loaded reports. Your webapp controls print layout through `@media print`. Browser cookies and authentication are isolated per request; caller credentials are not forwarded.

Errors use `{ "error": { "code", "message", "requestId", "details"? } }`. Validation and malformed JSON return 400, unknown endpoints/templates 404, upstream HTTP failures 502, queue capacity/wait timeout 503, and rendering timeouts 504. Unexpected errors return a generic 500 and are logged with the request ID. JSON requests are limited to 100 KB.

See [examples/README.md](../examples/README.md) for examples grouped by PDF, PowerPoint, and data API workflows.

## Generate test output files

```bash
npm run browser:install
npm run test:outputs
```

The test starts local HTTP servers, downloads real files from the routes, validates PDF/PPTX contents, and saves them in `output/routes/`:

- `id2222.pdf` — default language, from `/id2222.pdf`.
- `id2222-de.pdf` — language override, from `/id2222.pdf?language=de`.
- `custom-report.pdf` — readiness selector and print options, from GET `/api/exports/pdf`.
- `quarterly-review.pptx` — editable presentation, from GET `/api/exports/pptx/pptxgenjs/brief`.
- `customer-proposal.pptx` — edited template, from GET `/api/exports/pptx/jszip/business`.
- `demo-report.pptx` — native table and line chart with random data, from GET `/api/exports/pptx/jszip/daa`.
- `manifest.json` — exact request URLs, output paths, and file sizes.

The tests provide their own local webapp and need no running demo server. Output files are ignored by Git. The short `/id2222.pptx` route is not implemented yet; these tests cover the existing PowerPoint routes.

## Simple PDF download

Open this URL in your browser outside Docker:

```text
http://localhost:3000/id2222.pdf?language=en
```

The document ID is the filename. Add ordinary query parameters as needed:

Query parameters are optional: `http://localhost:3000/id2222.pdf` uses `documentSettings.defaultLanguage` (`en` by default). Change it in `src/config.ts` to choose a different default. An explicit `language` overrides the default unless the route pattern fixes the language itself. Other omitted parameters use the upstream webapp's defaults.

```text
http://localhost:3000/id2222.pdf?language=en&year=2026
```

The API forwards those parameters to the configured webapp document route. No JSON is needed for this download URL.

All endpoints currently registered by Generator API are listed below. Commands use the default API address, `http://localhost:3000`, and run from the repository root.

## Start the servers

Requires Node.js 22+.

```bash
npm ci
npm run browser:install
cp .env.example .env
npm run dev
```

In a second terminal, start the included webapp for the PDF examples:

```bash
npm run demo
```

The examples assume `WEBAPP_BASE_URL=http://localhost:3001` and `documentSettings.pdfRoutePattern = "/documents/{id}"` in `src/config.ts`. If you configured different hosts or routes, adjust the requests accordingly. PowerPoint generation does not require the demo webapp or Chromium.

## Query parameter format

Pass text fields directly. Encode `query` and `replacements` as JSON objects, `slides` as a JSON array, and `landscape` as `true` or `false`. Use `curl --get --data-urlencode` to encode spaces, punctuation, and JSON. Repeated parameters and unknown fields are rejected. GET requests do not require a JSON body. Existing POST endpoints remain supported for compatibility.

Large presentations or replacement text may exceed URL limits imposed by browsers, proxies, or hosting servers; use POST with JSON for those larger requests.

For testing from outside Docker, set `HOST=0.0.0.0` and publish port 3000. The included devcontainer publishes it to your computer's `127.0.0.1:3000`; rebuild the devcontainer to apply this setting. See [Docker access instructions](getting-started.md#access-from-outside-docker).

## Endpoint list

### Random table and chart download

Open `http://localhost:3000/api/exports/pptx/jszip/daa` or download it:

```bash
curl --fail-with-body http://localhost:3000/api/exports/pptx/jszip/daa --output demo-report.pptx
```

No parameters are required. The objects are found by their Selection Pane names: `TAB100` (table), `GGO` (chart), and `TEXT_ME` (text). Set the text with `http://localhost:3000/api/exports/pptx/jszip/daa?TEXT_ME=Hello%20world`; omitting `TEXT_ME` uses `Generated report`. The value accepts up to 5,000 characters and is inserted as literal text, preserving the first text run’s formatting. Object names must be unique across the presentation. The chart and embedded workbook are located through their relationships, so object order and chart filenames may change. The table must remain 4×4 and the chart must retain its three-series data layout. Every request preserves the first row of `templates/daa.pptx`'s 4×4 table and fills only the last three rows (12 cells) with random integers from 1–100. The line chart receives a separate set of 20 random rows across three series, with category labels `A1`–`A20`. Series names and styles are preserved; category labels and ranges expand to 20 rows. The chart cache and embedded Excel workbook are both updated so the chart remains native and editable using PowerPoint's **Edit Data**. This route uses the PowerPoint queue and leaves the source template unchanged.

### All routes

| Method | Endpoint                            | Successful response                               |
| ------ | ----------------------------------- | ------------------------------------------------- |
| GET    | `/health`                           | JSON process health                               |
| GET    | `/api/exports/pptx/jszip/daa`       | Native table and line chart with random data      |
| GET    | `/:id.pdf`                          | PDF attachment for a document ID                  |
| GET    | `/api/exports/pdf`                  | PDF attachment for a webapp route                 |
| GET    | `/api/exports/pptx/pptxgenjs/brief` | Generated editable PowerPoint attachment          |
| GET    | `/api/exports/pptx/jszip/business`  | PowerPoint attachment with template text replaced |

PowerPoint template names are fixed route segments: `brief` uses PptxGenJS; `business`, `summary`, and `daa` use JSZip. Exposing another template requires a dedicated route. Unknown paths return 404 `NOT_FOUND`.

## GET /health

```bash
curl --fail-with-body http://localhost:3000/health
```

Response (200):

```json
{ "status": "ok" }
```

This checks process availability; it does not check Chromium or the upstream webapp.

## GET /:id.pdf

Download a PDF using a document ID:

```bash
curl --fail-with-body 'http://localhost:3000/id2222.pdf' \
  --output id2222.pdf
```

Forward additional query parameters to the webapp:

```bash
curl --fail-with-body 'http://localhost:3000/id2222.pdf?language=en' \
  --output id2222-en.pdf
```

With the default configuration, these render `/documents/id2222` and `/documents/id2222?language=en` on the configured webapp host. The demo supports the document route, though it does not use the language parameter.

The ID must contain 1–80 letters, numbers, underscores, or hyphens. Query values must be strings; duplicate query keys are rejected. Keys already present in `documentSettings.pdfRoutePattern` cannot be overridden.

For a webapp that expects the document ID in a query parameter, configure the host in `.env` and the route in `src/config.ts`:

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

Then `/id2222.pdf?language=en` renders `https://other-host.example/document?id=id2222&language=en`. That route must exist on your webapp; it is not provided by the demo.

Success returns 200 with `Content-Type: application/pdf` and attachment filename `id2222.pdf`. This endpoint uses A4 portrait output and has no per-request readiness selector; use GET /api/exports/pdf for those options.

## GET /api/exports/pdf

Minimal request using the included demo:

```bash
curl --fail-with-body --get http://localhost:3000/api/exports/pdf \
  --data-urlencode 'route=/reports/quarterly' \
  --output document.pdf
```

Request with all supported fields:

```bash
curl --fail-with-body --get http://localhost:3000/api/exports/pdf \
  --data-urlencode 'route=/reports/quarterly' \
  --data-urlencode 'query={"year":2026,"quarter":3,"print":true}' \
  --data-urlencode 'filename=quarterly-report' \
  --data-urlencode 'waitForSelector=[data-report-ready]' \
  --data-urlencode 'format=A4' \
  --data-urlencode 'landscape=false' \
  --output quarterly-report.pdf
```

Equivalent GET request using the values in `examples/pdf/request.json`:

```bash
curl --fail-with-body --get http://localhost:3000/api/exports/pdf \
  --data-urlencode 'route=/reports/quarterly' \
  --data-urlencode 'query={"year":2026,"quarter":3,"print":true}' \
  --data-urlencode 'filename=quarterly-report' \
  --data-urlencode 'waitForSelector=[data-report-ready]' \
  --data-urlencode 'format=A4' \
  --data-urlencode 'landscape=false' \
  --output quarterly-report.pdf
```

| Field             | Required | Accepted values / default                                                                                                                       |
| ----------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `route`           | Yes      | Relative webapp route starting with `/`, up to 2,000 characters; external URLs, `//` prefixes, backslashes, and control characters are rejected |
| `query`           | No       | Object with string, finite number, or boolean values; default `{}`                                                                              |
| `filename`        | No       | 1–80 letters, numbers, underscores, or hyphens, without extension; default `document`                                                           |
| `waitForSelector` | No       | Nonempty selector, up to 300 characters; generation waits for it to be visible                                                                  |
| `format`          | No       | `A4` (default) or `Letter`                                                                                                                      |
| `landscape`       | No       | Boolean; default `false`                                                                                                                        |

Query keys may contain up to 100 characters and string values up to 2,000 characters. Unknown query fields are rejected. The route must exist on `WEBAPP_BASE_URL`. Caller cookies and authentication are not forwarded to the webapp.

Success returns 200 with `Content-Type: application/pdf` and the requested attachment filename plus `.pdf`.

## GET /api/exports/pptx/pptxgenjs/brief

`brief` is a fixed route segment selecting the existing brief design. Both GET
and POST use this template; other names return 404 `NOT_FOUND`.

Generate a new editable presentation:

```bash
curl --fail-with-body --get http://localhost:3000/api/exports/pptx/pptxgenjs/brief \
  --data-urlencode 'filename=quarterly-review' \
  --data-urlencode 'title=Quarterly review' \
  --data-urlencode 'subtitle=Strategy and delivery' \
  --data-urlencode 'author=Product team' \
  --data-urlencode 'accent=2563EB' \
  --data-urlencode 'slides=[{"title":"Results","bullets":["Delivered 12 projects","Customer satisfaction reached 96%"],"notes":"Discuss the results with the team."},{"title":"Next steps","bullets":["Validate with real reports","Measure performance"]}]' \
  --output quarterly-review.pptx
```

Equivalent GET request using the existing example file values:

```bash
curl --fail-with-body --get http://localhost:3000/api/exports/pptx/pptxgenjs/brief \
  --data-urlencode 'filename=quarterly-review' \
  --data-urlencode 'title=A clearer path forward' \
  --data-urlencode 'subtitle=Quarterly review · Strategy and delivery' \
  --data-urlencode 'author=Product team' \
  --data-urlencode 'accent=2563EB' \
  --data-urlencode 'slides=[{"title":"What we learned","bullets":["Customers value a simpler workflow","Reliable exports save teams time","Reusable templates keep communication consistent"],"notes":"Introduce the key findings and invite questions."},{"title":"Next steps","bullets":["Validate the proof of concept with real reports","Add templates for each team","Measure performance before scaling"]}]' \
  --output quarterly-review.pptx
```

| Field              | Required | Accepted values / default                                |
| ------------------ | -------- | -------------------------------------------------------- |
| `title`            | Yes      | 1–100 characters                                         |
| `slides`           | Yes      | 1–30 content slides                                      |
| `slides[].title`   | Yes      | 1–100 characters                                         |
| `slides[].bullets` | Yes      | 1–6 strings, each 1–220 characters                       |
| `slides[].notes`   | No       | Speaker notes, up to 3,000 characters                    |
| `subtitle`         | No       | Up to 180 characters; default empty string               |
| `author`           | No       | Up to 100 characters; default `Generator API`            |
| `accent`           | No       | Six hexadecimal characters without `#`; default `2563EB` |
| `filename`         | No       | Same filename rules as PDF; default `presentation`       |

Unknown query and slide fields are rejected. The `brief` template adds a cover followed by the supplied content slides.

Success returns 200 with `Content-Type: application/vnd.openxmlformats-officedocument.presentationml.presentation` and the attachment filename plus `.pptx`.

## GET/POST /api/exports/pptx/jszip/summary

This fixed route fills `templates/summary.pptx` using the same replacement
contract as business. Supply `title`, `subtitle`, and `customer`.

```bash
curl --fail-with-body http://localhost:3000/api/exports/pptx/jszip/summary \
  -H 'Content-Type: application/json' \
  --data '{"filename":"summary","replacements":{"title":"Quarterly summary","subtitle":"Results and outlook","customer":"Acme"}}' \
  --output summary.pptx
```

GET accepts `replacements` as a JSON query string and an optional `filename`.
The source template remains unchanged. Missing replacements return 400.

## GET /api/exports/pptx/jszip/business

`business` is a fixed route segment selecting the existing business template.
Both GET and POST use this template; other names return 404 `NOT_FOUND`.

Replace text placeholders in the included `templates/business.pptx`:

```bash
curl --fail-with-body --get http://localhost:3000/api/exports/pptx/jszip/business \
  --data-urlencode 'filename=customer-proposal' \
  --data-urlencode 'replacements={"title":"A clearer path forward","subtitle":"A proposal built from our existing PowerPoint template","customer":"Acme Corporation"}' \
  --output customer-proposal.pptx
```

Equivalent GET request using the existing example file values:

```bash
curl --fail-with-body --get http://localhost:3000/api/exports/pptx/jszip/business \
  --data-urlencode 'filename=customer-proposal' \
  --data-urlencode 'replacements={"title":"A clearer path forward","subtitle":"A proposal built from our existing PowerPoint template","customer":"Acme Corporation"}' \
  --output customer-proposal.pptx
```

| Field          | Required | Accepted values / default                                                |
| -------------- | -------- | ------------------------------------------------------------------------ |
| `replacements` | Yes      | Object containing 1–100 replacement strings, each up to 5,000 characters |
| `filename`     | No       | Same filename rules as PDF; default `presentation`                       |

Replacement keys must start with a letter and contain only letters, numbers, or underscores, up to 64 characters. Use keys without braces: `title` replaces `{{title}}`. The included business template requires exactly `title`, `subtitle`, and `customer`. Missing or unknown replacement keys return 400. Unknown query fields are rejected.

Slide and speaker-note text is replaced while the original template file stays unchanged. Layout and text-box sizing remain as authored in the template.

Success returns 200 with `Content-Type: application/vnd.openxmlformats-officedocument.presentationml.presentation` and the attachment filename plus `.pptx`.

## Responses and errors

All responses include an `X-Request-Id` header. Generated attachments include `Cache-Control: no-store`. Generation requests keep the HTTP connection open while queued and return the file directly.

Errors return JSON in this shape:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request parameters",
    "details": [{ "path": ["route"], "message": "Example validation message" }],
    "requestId": "request-specific-id"
  }
}
```

`details` appears for validation errors. Actual details and request IDs vary.

| HTTP status | Meaning                                                                                      |
| ----------- | -------------------------------------------------------------------------------------------- |
| 400         | Invalid parameters, malformed JSON, invalid replacement keys, or reserved GET PDF query keys |
| 404         | Unknown API endpoint or presentation template                                                |
| 413         | POST JSON body exceeds the 100 KB limit                                                      |
| 500         | Unexpected document generation failure                                                       |
| 502         | Upstream webapp HTTP failure                                                                 |
| 503         | Queue full, queue wait expired, or queue unavailable; includes `Retry-After: 5`              |
| 504         | Rendering timeout                                                                            |

With `curl --fail-with-body`, HTTP errors produce a nonzero exit code. When `--output` is supplied, the error response body is also written to that file, so check the command's exit status before opening it as a PDF or PPTX.

## Demo webapp routes

These run on the separate demo server at port 3001 and return HTML for PDF rendering:

| Method | URL                                                           | Purpose                                                              |
| ------ | ------------------------------------------------------------- | -------------------------------------------------------------------- |
| GET    | `http://localhost:3001/reports/quarterly?year=2026&quarter=3` | Quarterly report; supports numeric `year` and `quarter` query values |
| GET    | `http://localhost:3001/documents/id2222`                      | Document page used by the default GET PDF route                      |

See [README.md](../README.md) for configuration, deployment, and template registration instructions.

## Route source files

Endpoint paths come from folders under `src/routes/`; method files such as
`get.ts` and `post.ts` export factories that receive injected services.
See [the file-routing guide](../src/routes/README.md) for adding endpoints. Existing
URLs, query parameters and download contracts are unchanged.
