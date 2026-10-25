# API Endpoints Reference

[Back to Documentation Index](../README.md)

## Registered Routes (`src/routes/router.ts`)

All `GET` routes also accept `HEAD` (validating parameters and returning
response headers without entering a generation queue or rendering a document).

| Method            | Path                 | Purpose & Output                                                              |
| ----------------- | -------------------- | ----------------------------------------------------------------------------- |
| `GET, HEAD`       | `/health`            | Process liveness (`200 { "status": "ok" }`)                                   |
| `GET, HEAD`       | `/internal/ready`    | Readiness probe (`200` when templates & renderer are ready, `503` otherwise)  |
| `GET, HEAD`       | `/internal/metrics`  | Queue, renderer, template, and per-route request metrics                      |
| `GET, HEAD`       | `/pdf/example`       | Portrait PDF of `https://example.com/` (`example.pdf`)                        |
| `GET, HEAD`       | `/pdf/factsheet/:id` | Portrait PDF of `/factsheet/:id` on `WEBAPP_BASE_URL` (`{id}.pdf`)            |
| `GET, HEAD`       | `/pdf/onepager/:id`  | Landscape PDF of `/onepager/:id` (`onepager-YYYY-MM-DD-HH-mm-{id}.pdf`)       |
| `GET, HEAD`       | `/pdf/quarterly`     | Portrait PDF of `/reports/quarterly` waiting for `[data-report-ready]`        |
| `GET, HEAD`       | `/pptx/daa`          | Editable PPTX from `templates/daa.pptx` with table, chart, and text           |
| `GET, HEAD`       | `/pptx/tma`          | Editable PPTX from `templates/Tmp1.pptx` with charts, dates, colors           |
| `GET, HEAD`       | `/pptx/sample1`      | Editable PPTX from `templates/template_3.pptx` (duplicated slides, demo data) |
| `GET, HEAD, POST` | `/pptxgenjs/brief`   | Programmatic PPTX presentation (`brief` design) from query or JSON            |

## Request metrics

`GET /internal/metrics` returns `endpoints`, grouped by route pattern and HTTP method
(per-status counts are in each entry's `byStatus`).
Parameter values, query strings, and bodies are never included in these summaries.
Only endpoints with observed traffic appear.

Each endpoint includes:

- `requests`: completed requests, including aborted responses.
- `byStatus`, `failures`: status counts and the number with status >= 400.
- `abortedRequests`: responses closed before finishing (reported as status `499`).
- `inFlight`: requests still being handled.
- `lastRequestedAt`: latest request start time as a UTC ISO timestamp.
- `durationMs`, `queueWaitMs`, `generationMs`, `outputBytes`: `total`, `average`,
  and `max` across completed requests. Aborted responses contribute zero output bytes.
- `durationMs.p95`: nearest-rank 95th percentile of the latest 256 completions
  (or all completions when fewer); `null` before the first completion.

Counters are local to each application instance and reset on restart. Log
exclusions do not exclude metrics: health checks and metrics requests also count.
A request without a matched route, including one rejected before routing, uses
`unmatched`; in-flight requests use this label until routing resolves.

## Endpoint Contracts

### `GET /pdf/factsheet/:id`

- **Path parameter**: `id` — `1..80` alphanumeric, `_`, or `-` characters.
- **Query parameters**: None allowed (`.strict()`).
- **Output**: `application/pdf` attachment named `{id}.pdf` (portrait).

```bash
curl --fail-with-body http://localhost:3000/pdf/factsheet/id2222 -o factsheet.pdf
```

### `GET /pdf/onepager/:id`

- **Path parameter**: `id` — `1..80` alphanumeric, `_`, or `-` characters.
- **Query parameters** (all optional):
  - `START`: ISO date `YYYY-MM-DD`
  - `END`: ISO date `YYYY-MM-DD`
  - `BENCHMARK`: `'SAA'` | `'REPORTING'`
- **Output**: `application/pdf` attachment named
  `onepager-YYYY-MM-DD-HH-mm-{id}.pdf` (or `{id}.pdf` if exceeding 80 chars),
  always landscape.

```bash
curl --fail-with-body \
  'http://localhost:3000/pdf/onepager/id2222?START=2026-01-01&END=2026-12-31&BENCHMARK=SAA' \
  -o onepager.pdf
```

### `GET /pdf/quarterly`

- **Query parameters** (all optional):
  - `year`: 4-digit year `2000..2100` (forwarded to webapp)
  - `quarter`: `1..4` (forwarded to webapp)
  - `language`: `'en'` | `'de'` | `'pl'` (defaults to `config.defaultLanguage` = `'en'`)
- **Readiness**: Waits for `[data-report-ready]` to become visible.
- **Output**: `application/pdf` attachment named
  `quarterly-{year}-q{quarter}-{language}.pdf`.

```bash
curl --fail-with-body \
  'http://localhost:3000/pdf/quarterly?year=2026&quarter=2&language=de' \
  -o quarterly.pdf
```

### `GET /pdf/example`

- **Query parameters**: None allowed.
- **Target**: Renders `https://example.com/` (`externalOrigin` override).
- **Output**: `application/pdf` attachment named `example.pdf`.

### `GET /pptx/daa` and `GET /pptx/tma`

- **Query parameters**:
  - `TEXT_ME` (optional): `1..5000` XML-valid characters (defaults to
    `'Generated report'`).
- **Behavior**:
  - `/pptx/daa` populates `TAB100`, `GGO`, and `TEXT_ME` in
    `templates/daa.pptx` and downloads `demo-report.pptx`.
  - `/pptx/tma` populates `X_CHART_A`, `X_CHART_B`, `X_T0`, `X_T1`, `X_T2`,
    and `X_SUB` in `templates/Tmp1.pptx` and downloads `tma.pptx`.

```bash
curl --fail-with-body 'http://localhost:3000/pptx/daa?TEXT_ME=Hello%20world' -o demo-report.pptx
curl --fail-with-body 'http://localhost:3000/pptx/tma?TEXT_ME=Hello%20world' -o tma.pptx
```

### `GET, POST /pptxgenjs/brief`

- **Fields**:
  - `title`: `1..100` characters (required)
  - `subtitle`: `0..180` characters (optional, defaults to `''`)
  - `author`: `0..100` characters (optional, defaults to `'Generator API'`)
  - `accent`: 6-digit hex color without `#`, e.g. `'0F766E'` (optional, defaults to `'2563EB'`)
  - `filename`: `1..80` alphanumeric, `_`, or `-` characters (defaults to `'presentation'`)
  - `slides`: Array of `1..30` slides (JSON-encoded string on `GET`), each with
    `title` (`1..100` chars), `bullets` (`1..6` items of `1..220` chars), and
    optional `notes` (`0..3000` chars).
  - All text fields must contain only XML 1.0 characters.

```bash
curl -X POST http://localhost:3000/pptxgenjs/brief \
  -H 'Content-Type: application/json' \
  --data-binary @examples/pptx/generated.json -o brief.pptx
```

## Error Response Contract

All error responses return JSON with `X-Request-Id`:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request parameters",
    "details": [{ "path": ["year"], "message": "Invalid input" }],
    "requestId": "c3923fb2-..."
  }
}
```

| Status | Error Codes                                                                    | Cause                                                             |
| ------ | ------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| `400`  | `VALIDATION_ERROR`, `INVALID_QUERY_PARAMETER`, `INVALID_JSON`, `INVALID_ROUTE` | Schema validation failure, duplicate query keys, bad JSON         |
| `404`  | `NOT_FOUND`, `UNKNOWN_TEMPLATE`                                                | Unmatched route or unconfigured template                          |
| `413`  | `BODY_TOO_LARGE`                                                               | JSON body exceeds `100kb`                                         |
| `415`  | `UNSUPPORTED_CHARSET`, `UNSUPPORTED_CONTENT_ENCODING`                          | Unsupported request encoding                                      |
| `502`  | `UPSTREAM_ERROR`, `NAVIGATION_BLOCKED`, `DATA_API_*`                           | Webapp non-2xx response, cross-origin redirect, Data API failure  |
| `503`  | `QUEUE_FULL`, `QUEUE_WAIT_TIMEOUT`, `QUEUE_CLOSED`, `DATA_API_NOT_CONFIGURED`  | Capacity limit reached (`Retry-After: 5` header set)              |
| `504`  | `RENDER_TIMEOUT`, `DATA_API_TIMEOUT`                                           | Chromium render or upstream Data API timed out                    |
| `500`  | `INTERNAL_ERROR`, `INVALID_TEMPLATE`                                           | Unexpected error, broken `.pptx` template, or invalid server data |

`500` responses always carry the generic message `Document generation failed`
so that file paths and template internals never reach clients. The full error is
in the server log under the same `requestId` (see below). Requests abandoned by
the client are recorded with status `499` (`REQUEST_CANCELLED`) and stop
generation at the next step.

## Error Logs

Every failed request writes one structured log entry keyed by `requestId`
(also returned in the `X-Request-Id` header and the error body):

| Event               | Level   | When                                    | Fields                                                                   |
| ------------------- | ------- | --------------------------------------- | ------------------------------------------------------------------------ |
| `request_failed`    | `error` | status `>= 500`                         | `requestId`, `method`, `route`, `url`, `status`, `code`, `error`         |
| `request_rejected`  | `warn`  | status `4xx`                            | as above plus `message`, Zod `issues` (path/message/code), and `details` |
| `request_abandoned` | `warn`  | client disconnected before the response | as above plus `reason` and `error`                                       |

`error` is the serialized error chain: `name`, `message`, `status`, `code`,
`details`, `stack`, nested `cause` (for example the Node `ECONNREFUSED` behind
`DATA_API_UNAVAILABLE`) and `errors` for aggregate failures. `details` carries
the context for each failure type:

- **PDF**: `url`, `phase` (`launch`, `context`, `navigate`, `waitForSelector`,
  `waitForNetworkIdle`, `applyStyles`, `waitForFonts`, `print`), `timeoutMs`,
  `elapsedMs`, `browserState`; `UPSTREAM_ERROR` adds the webapp `status`;
  `NAVIGATION_BLOCKED` adds `blockedUrl`, `allowedOrigin` and `reason`.
- **Data API**: `url`, `timeoutMs`, `elapsedMs`; HTTP errors add `status`,
  `statusText` and redirect `location`; schema errors add the Zod `issues`.
- **Templates**: the part path, object name, slide, and expected versus actual
  row, column, series or category counts.
- **Internal validation** (`INTERNAL_ERROR`): the `label` of the data that failed
  and its Zod `issues`.

Startup and shutdown also log `template_validation_failed`,
`browser_warmup_failed`, `shutdown_started`, `shutdown_completed`,
`shutdown_failed` and `shutdown_deadline_exceeded` with their serialized errors.
