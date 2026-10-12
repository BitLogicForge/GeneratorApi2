# API endpoints

[Back to overview](../README.md)

## Overview

PDF route exports and the brief, business, and summary PowerPoint exports support GET and POST. The document-ID PDF link and DAA demo support GET. All GET exports also accept HEAD with the same query schemas: successful HEAD responses return download headers without generating a document or entering a queue, and omit the unknown `Content-Length`. HEAD checks request syntax and configured services; it does not fetch upstream data or confirm that generation will succeed. Text fields are query strings; `query`, `slides`, and `replacements` contain URL-encoded JSON, and `landscape` is `true` or `false`. Existing POST requests remain supported.

| Endpoint                                 | Input                                                                                              | Result                           |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------- | -------------------------------- |
| `POST /pdf/test`                         | Relative `route`, optional `query`, `filename`, `waitForSelector`, `format`, `landscape`           | PDF attachment                   |
| `GET /pdf/factsheet/:id`                 | Document ID; optional webapp query parameters                                                      | PDF attachment, always portrait  |
| `GET /pdf/onepager/:id`                  | Document ID; optional webapp query parameters                                                      | PDF attachment, always landscape |
| `POST /api/exports/pptx/pptxgenjs/brief` | Fixed brief design; `title`, `slides`, optional `subtitle`, `author`, `accent`, `filename` in JSON | Editable PPTX attachment         |
| `GET /health`                            | None                                                                                               | Process health                   |

PowerPoint's `brief` template creates a dark cover and light numbered content slides. Each slide takes `title`, 1–6 `bullets`, and optional speaker `notes`. Accent is a six-digit hex color without `#`. Up to 30 content slides are supported. Filenames omit extensions and accept letters, numbers, underscores, and hyphens.

The PDF endpoint combines the route with the configured origin. The base PDF endpoint accepts only declared webapp query fields: `language`, `year`, `quarter`, and `print`. It prints with background colors, A4 by default, and 12 mm margins. Use a visible readiness marker such as `[data-report-ready]` for asynchronously loaded reports. Your webapp controls print layout through `@media print`; server defaults are configured in `pdfPrintSettings` in `src/config/defaults.ts`. Browser cookies and authentication are isolated per request; caller credentials are not forwarded.

Errors use `{ "error": { "code", "message", "requestId", "details"? } }`. Validation and malformed JSON return 400, unknown endpoints/templates 404, unsupported JSON charsets/content encodings 415, upstream HTTP failures 502, queue capacity/wait timeout 503, and rendering timeouts 504. Unexpected errors return a generic 500 and are logged with the request ID. JSON requests are limited to 100 KB.

PDF navigation, including every redirect hop and frame, must stay on `WEBAPP_BASE_URL`'s origin. Same-origin redirects are supported; popups and navigation outside that origin fail with 502 `NAVIGATION_BLOCKED` before the destination is requested. External assets and data requests are still allowed.

All PowerPoint text fields must contain XML 1.0-compatible characters. Forbidden controls, lone UTF-16 surrogates, U+FFFE, and U+FFFF return 400 `VALIDATION_ERROR`. Tabs, line endings, and valid Unicode, including emoji, are accepted and preserved.

See [examples/README.md](../examples/README.md) for examples grouped by PDF, PowerPoint, and data API workflows.

## Generate test output files

```bash
npm run browser:install
npm run test:outputs
```

The test starts local HTTP servers, downloads real files from the routes, validates PDF/PPTX contents, and saves them in `output/routes/`:

- `document-portrait.pdf` — portrait, default language, from `/pdf/factsheet/id2222`.
- `document-portrait-de.pdf` — portrait, language override, from `/pdf/factsheet/id2222?language=de`.
- `quarterly-2027-q2-pl.pdf` — fixed portrait page with forwarded GET parameters.
- `document-landscape.pdf` — landscape, from `/pdf/onepager/id2222`.
- `quarterly-report-portrait.pdf` and `quarterly-report-landscape.pdf` — POST payload examples from `examples/pdf/`.
- `custom-report.pdf` — readiness selector and print options, from GET `/pdf/test`.
- `quarterly-review.pptx` — editable presentation, from GET `/api/exports/pptx/pptxgenjs/brief`.
- `customer-proposal.pptx` — edited template, from GET `/api/exports/pptx/jszip/business`.
- `demo-report.pptx` — native table and line chart with random data, from GET `/api/exports/pptx/jszip/daa`.
- `manifest.json` — exact request URLs, output paths, and file sizes.

The tests provide their own local webapp and need no running demo server. Output files are ignored by Git. The short `/id2222.pptx` route is not implemented yet; these tests cover the existing PowerPoint routes.

## Simple PDF download

Open this URL in your browser outside Docker:

```text
http://localhost:3000/pdf/factsheet/id2222?language=en
```

The document ID is the filename. Factsheet accepts `language` and `year`. Onepager accepts `START`, `END`, and `BENCHMARK`:

Query parameters are optional: `http://localhost:3000/pdf/factsheet/id2222` uses the route-local `defaultLanguage` (`en` by default). Change it in the endpoint's `report.ts` to choose a different default. An explicit `language` overrides the default unless the route pattern fixes the language itself. Other omitted parameters use the upstream webapp's defaults.

```text
http://localhost:3000/pdf/factsheet/id2222?language=en&year=2026
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

The examples assume `WEBAPP_BASE_URL=http://localhost:3001` and the external routes defined in each PDF endpoint's `report.ts`. If you configured different hosts or routes, adjust the requests accordingly. PowerPoint generation does not require the demo webapp or Chromium.

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

| Method          | Endpoint                            | Successful GET/POST response                               |
| --------------- | ----------------------------------- | ---------------------------------------------------------- |
| GET, HEAD       | `/health`                           | JSON process health (HEAD omits the body)                  |
| GET, HEAD       | `/api/exports/pptx/jszip/daa`       | Native table and line chart with random data               |
| GET, HEAD       | `/pdf/factsheet/:id`                | PDF attachment for a document ID                           |
| GET, HEAD       | `/pdf/quarterly`                    | Fixed portrait quarterly report with direct GET parameters |
| GET, HEAD       | `/pdf/onepager/:id`                 | PDF attachment for a document ID, always landscape         |
| GET, HEAD, POST | `/pdf/test`                         | PDF attachment for a webapp route                          |
| GET, HEAD, POST | `/api/exports/pptx/pptxgenjs/brief` | Generated editable PowerPoint attachment                   |
| GET, HEAD, POST | `/api/exports/pptx/jszip/summary`   | PowerPoint attachment with summary template text replaced  |
| GET, HEAD, POST | `/api/exports/pptx/jszip/business`  | PowerPoint attachment with business template text replaced |

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

## GET /pdf/factsheet/:id

Renders `/factsheet/{id}` on `WEBAPP_BASE_URL`, always in portrait orientation:

```bash
curl --fail-with-body 'http://localhost:3000/pdf/factsheet/id2222?language=en' --output factsheet.pdf
```

The API URL has no `.pdf` suffix; its attachment filename is `id2222.pdf`.

## GET /pdf/onepager/:id

Renders `/onepager/{id}` on `WEBAPP_BASE_URL`, always in landscape orientation:

```bash
curl --fail-with-body 'http://localhost:3000/pdf/onepager/id2222?START=2027-01-01&END=2027-12-31&BENCHMARK=SAA' --output onepager.pdf
```

This selects its own external page rather than reprinting the factsheet page. Both endpoints return `Content-Type: application/pdf`, attachment downloads, `Cache-Control: no-store`, and request IDs. The filename remains `id2222.pdf`.

Both routes support HEAD without rendering. IDs accept 1–80 letters, numbers, underscores, and hyphens. The allowed query parameters depend on the route:

| Parameter   | Route     | Accepted values                            | Default                                                |
| ----------- | --------- | ------------------------------------------ | ------------------------------------------------------ |
| `language`  | Factsheet | Nonempty text, up to 100 characters        | Route-local default unless fixed by the external route |
| `year`      | Factsheet | Four digits, 2000–2100                     | Omitted                                                |
| `START`     | Onepager  | Valid calendar date in `YYYY-MM-DD` format | Omitted                                                |
| `END`       | Onepager  | Valid calendar date in `YYYY-MM-DD` format | Omitted                                                |
| `BENCHMARK` | Onepager  | `SAA` or `REPORTING`                       | Omitted                                                |

Onepager forwards `START`, `END`, and `BENCHMARK` under those exact uppercase
names. Each is independently optional; `language` and `year` are rejected on onepager.

Unknown parameters, duplicate values, unsafe IDs, and invalid values return 400. Caller-supplied `landscape`, `route`, and `waitForSelector` are rejected. These routes use the shared renderer and queue; configured appearance applies with the endpoint's fixed orientation, defined only through `print.landscape` in its `report.ts`.

Each endpoint folder defines the complete PDF route:

- `src/routes/pdf/onepager/[id]/schema.ts` declares the path ID and allowed query parameters.
- `src/routes/pdf/onepager/[id]/report.ts` defines the external route, parameter mapping, filename, and print settings.
- `src/routes/pdf/onepager/[id]/get.ts` exports that definition as the GET endpoint.

The factsheet folder has the same structure and its own independent definitions.
In each `report.ts`, `externalRoute` defines the trusted webapp path (for example,
`/onepager/{id}` or `/document?id={id}`). `prepareInput` maps the validated API
ID into that pattern and uses `mapPdfRoute` from `src/reports/pdf-route.ts`
with a mapping object such as `{ START: 'from', END: 'to', BENCHMARK: 'benchmark' }`.
Mapping keys are public input names; values are external query names. The helper
omits undefined values and rejects conflicts with fixed external query keys. Add or change public parameters in that folder's `schema.ts`
and their mapping in its `report.ts`. Fixed query keys in the external route
cannot be overridden by callers. Configure the shared webapp origin through
`WEBAPP_BASE_URL`.

The former `/pdf/portrait/:id.pdf` and `/pdf/landscape/:id.pdf` document routes are removed.

## GET /pdf/quarterly

Prints the fixed `/reports/quarterly` endpoint on `WEBAPP_BASE_URL`, always in
portrait. Direct query parameters are validated and forwarded to that webapp
endpoint through GET. The page must expose `[data-report-ready]` before printing.
HEAD validates parameters and returns download headers without fetching the page.

```bash
curl --fail-with-body 'http://localhost:3000/pdf/quarterly?year=2027&quarter=2&language=pl' --output quarterly-2027-q2-pl.pdf
```

With the demo configuration, Chromium requests
`http://localhost:3001/reports/quarterly?year=2027&quarter=2&language=pl`.
The attachment filename is `quarterly-2027-q2-pl.pdf`.

| Parameter  | Accepted values        | Default |
| ---------- | ---------------------- | ------- |
| `year`     | Four digits, 2000–2100 | 2026    |
| `quarter`  | 1, 2, 3, 4             | 3       |
| `language` | en, de, pl             | en      |

Unknown keys, repeated values and invalid values return 400. The caller cannot
change the target route or print orientation. This example's target is defined
in `src/routes/pdf/quarterly/report.ts`; other print defaults remain shared.

## GET /pdf/test

Minimal request using the included demo:

```bash
curl --fail-with-body --get http://localhost:3000/pdf/test \
  --data-urlencode 'route=/reports/quarterly' \
  --output document.pdf
```

Request with all supported fields:

```bash
curl --fail-with-body --get http://localhost:3000/pdf/test \
  --data-urlencode 'route=/reports/quarterly' \
  --data-urlencode 'query={"year":2026,"quarter":3,"print":true}' \
  --data-urlencode 'filename=quarterly-report' \
  --data-urlencode 'waitForSelector=[data-report-ready]' \
  --data-urlencode 'format=A4' \
  --data-urlencode 'landscape=false' \
  --output quarterly-report.pdf
```

Equivalent GET request using the values in `examples/pdf/quarterly-portrait.json`:

```bash
curl --fail-with-body --get http://localhost:3000/pdf/test \
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
| `query`           | No       | Strict object: optional `language`, `year`, `quarter`, `print`; default `{}`                                                                    |
| `filename`        | No       | 1–80 letters, numbers, underscores, or hyphens, without extension; default `document`                                                           |
| `waitForSelector` | No       | Nonempty selector, up to 300 characters; generation waits for it to be visible                                                                  |
| `format`          | No       | `A3`, `A4`, `A5`, `A6`, `Letter`, `Legal`, `Tabloid`, `Ledger`; default from `pdfPrintSettings.format` (initially `A4`)                         |
| `landscape`       | No       | Boolean; default from `pdfPrintSettings.landscape` (initially `false`)                                                                          |

The `query` object accepts `language` (nonempty text, up to 100 characters),
`year` (integer or four-digit string, 2000–2100), `quarter` (integer or string,
1–4), and `print` (boolean). Unknown fields inside `query` and at the top level
are rejected. The route must exist on `WEBAPP_BASE_URL`. Caller cookies and authentication are not forwarded to the webapp.

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

DAA object names and demo data dimensions are configured together in `templateSettings` at the top of `src/services/jszip/daa-poc-presentation-service.ts`. The required-name list is derived from that configuration. The HTTP query parameter remains `TEXT_ME` even if the template’s text object is renamed.

Source PPTX templates are validated and cached in memory per service instance. Restart the API after replacing a template file. Each generation uses a fresh archive and still produces new document data.

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

| HTTP status | Meaning                                                                                               |
| ----------- | ----------------------------------------------------------------------------------------------------- |
| 400         | Invalid parameters, malformed JSON, invalid replacement keys, or reserved GET PDF query keys          |
| 404         | Unknown API endpoint or presentation template                                                         |
| 413         | POST JSON body exceeds the 100 KB limit                                                               |
| 415         | Unsupported JSON charset (`UNSUPPORTED_CHARSET`) or content encoding (`UNSUPPORTED_CONTENT_ENCODING`) |
| 500         | Unexpected document generation failure                                                                |
| 502         | Upstream webapp HTTP failure                                                                          |
| 503         | Queue full, queue wait expired, or queue unavailable; includes `Retry-After: 5`                       |
| 504         | Rendering timeout                                                                                     |

With `curl --fail-with-body`, HTTP errors produce a nonzero exit code. When `--output` is supplied, the error response body is also written to that file, so check the command's exit status before opening it as a PDF or PPTX.

## Demo webapp routes

These run on the separate demo server at port 3001 and return HTML for PDF rendering:

| Method | URL                                                           | Purpose                                                              |
| ------ | ------------------------------------------------------------- | -------------------------------------------------------------------- |
| GET    | `http://localhost:3001/reports/quarterly?year=2026&quarter=3` | Quarterly report; supports numeric `year` and `quarter` query values |
| GET    | `http://localhost:3001/factsheet/id2222`                      | Factsheet page used by the portrait PDF route                        |

See [README.md](../README.md) for configuration, deployment, and template registration instructions.

## Route source files

Endpoint paths come from folders under `src/routes/`; method files such as
`get.ts` and `post.ts` export factories that receive injected services.
See [the file-routing guide](../src/routes/README.md) for adding endpoints. Existing
URLs, query parameters and download contracts are unchanged.

## Internal observability

`GET /internal/metrics` returns JSON containing process uptime and memory bytes,
PDF and presentation queue stats (active, pending, concurrency, maxPending,
accepting), browser state and launch/failure/disconnect counters, and cumulative
request counts, failures, output bytes, queue wait milliseconds and generation
milliseconds grouped by registered route, method and status. Counters reset on
restart; scrape and store snapshots for trends. Metrics requests include only
previous completed requests. HEAD is supported and returns no body.

`GET /internal/ready` returns 200 when startup template validation and Chromium
warmup have completed and both queues accept work; otherwise it returns 503.
The body reports `ready`, `shuttingDown`, `templates`, and `renderer`. Chromium
warms up once at startup without rendering a document. Disconnects make readiness
fail until a PDF request successfully relaunches Chromium. Probes never render,
launch a browser, read templates, or contact the webapp. `/health` stays an
inexpensive process check. Injected services in `createApp` may supply their own
readiness callback; otherwise their initialization is managed externally.

Both internal endpoints send `Cache-Control: no-store`. Restrict `/internal/*`
to your monitoring network at the reverse proxy; these endpoints have no built-in
authentication. Completion logs contain request IDs, registered route patterns,
format, status, durations and output bytes, excluding report text, tokens,
filenames, document IDs and query strings. Server failure logs record safe error
codes rather than raw exceptions. Disconnected responses use status 499; output
bytes count generated attachments sent by completed responses, not wire delivery.
PDF and PPTX capacity already have separate concurrency settings.

## PDF print configuration

Edit `pdfPrintSettings` in `src/config/defaults.ts` and rebuild/restart the application.
These settings apply to all PDF endpoints. The factsheet endpoint always forces portrait and the onepager endpoint always forces landscape. GET/POST `/pdf/test` can
still override `format` and `landscape` per request; omitted values use the
configured defaults.

| Setting                            | Purpose / default                                                                                                                                                           |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `format`, `landscape`              | A3, A4, A5, A6, Letter, Legal, Tabloid or Ledger; A4 portrait by default                                                                                                    |
| `margin`                           | Separate top/right/bottom/left margins in mm, 0–200; each defaults to 12                                                                                                    |
| `scale`                            | Content scale, 0.1–2; default 1                                                                                                                                             |
| `printBackground`                  | Print background colors and images; default true                                                                                                                            |
| `printImages`                      | Show images; default true. False hides img, picture, SVG, canvas, video and image inputs while preserving their layout space, and removes CSS background/list/border images |
| `media`                            | CSS media mode: `print` (default) or `screen`                                                                                                                               |
| `preferCSSPageSize`                | Let the webapp's CSS `@page` size take priority over paper format; default false                                                                                            |
| `displayHeaderFooter`              | Enable Chromium headers and footers; default false                                                                                                                          |
| `headerTemplate`, `footerTemplate` | HTML templates, empty by default. Supported classes: `date`, `title`, `url`, `pageNumber`, `totalPages`                                                                     |
| `hideSelectors`                    | CSS selectors to remove from print layout, e.g. `['nav', '.print-hidden']`; default []                                                                                      |
| `css`                              | Additional CSS applied after the webapp styles; default empty string                                                                                                        |

Example adjustments inside the configuration section:

```ts
margin: { top: 15, right: 10, bottom: 20, left: 10 },
printImages: false,
hideSelectors: ['nav', '.toolbar'],
displayHeaderFooter: true,
footerTemplate: '<div style="font-size:9px;width:100%;text-align:center"><span class="pageNumber"></span> / <span class="totalPages"></span></div>',
css: '@media print { body { font-size: 11pt; } h2 { break-after: avoid; } }',
```

Reserve sufficient top/bottom margins for headers/footers. Their templates do
not inherit webapp styles and do not execute scripts. Image visibility applies
to the main document; embedded iframe documents have their own styles. Hiding
images affects appearance, not network loading. Settings are validated at startup.
