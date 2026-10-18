# API Endpoints Reference

[Back to Documentation Index](../README.md)

## Registered Routes (`src/routes/router.ts`)

All `GET` routes also accept `HEAD` (validating parameters and returning
response headers without entering a generation queue or rendering a document).

| Method            | Path                 | Purpose & Output                                                             |
| ----------------- | -------------------- | ---------------------------------------------------------------------------- |
| `GET, HEAD`       | `/health`            | Process liveness (`200 { "status": "ok" }`)                                  |
| `GET, HEAD`       | `/internal/ready`    | Readiness probe (`200` when templates & renderer are ready, `503` otherwise) |
| `GET, HEAD`       | `/internal/metrics`  | Queue, renderer, template, and per-route request metrics                     |
| `GET, HEAD`       | `/pdf/example`       | Portrait PDF of `https://example.com/` (`example.pdf`)                       |
| `GET, HEAD`       | `/pdf/factsheet/:id` | Portrait PDF of `/factsheet/:id` on `WEBAPP_BASE_URL` (`{id}.pdf`)           |
| `GET, HEAD`       | `/pdf/onepager/:id`  | Landscape PDF of `/onepager/:id` (`onepager-YYYY-MM-DD-HH-mm-{id}.pdf`)      |
| `GET, HEAD`       | `/pdf/quarterly`     | Portrait PDF of `/reports/quarterly` waiting for `[data-report-ready]`       |
| `GET, HEAD`       | `/pptx/daa`          | Editable PPTX from `templates/daa.pptx` with table, chart, and text          |
| `GET, HEAD`       | `/pptx/tma`          | Editable PPTX from `templates/Tmp1.pptx` with charts, dates, colors          |
| `GET, HEAD, POST` | `/pptxgenjs/brief`   | Programmatic PPTX presentation (`brief` design) from query or JSON           |

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
  - `title`: `1..120` characters (required)
  - `subtitle`: `1..160` characters (optional)
  - `author`: `1..80` characters (optional)
  - `accent`: 6-digit hex color without `#`, e.g. `'0F766E'` (optional)
  - `filename`: `1..80` alphanumeric, `_`, or `-` characters (defaults to `'presentation'`)
  - `slides`: Array of `1..30` slides (JSON-encoded string on `GET`), each with
    `title` (`1..120` chars), `bullets` (`1..6` items of `1..240` chars), and
    optional `notes` (`1..2000` chars).

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

| Status | Error Codes                                                                    | Cause                                                            |
| ------ | ------------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| `400`  | `VALIDATION_ERROR`, `INVALID_QUERY_PARAMETER`, `INVALID_JSON`, `INVALID_ROUTE` | Schema validation failure, duplicate query keys, bad JSON        |
| `404`  | `NOT_FOUND`, `UNKNOWN_TEMPLATE`                                                | Unmatched route or unconfigured template                         |
| `413`  | `BODY_TOO_LARGE`                                                               | JSON body exceeds `100kb`                                        |
| `415`  | `UNSUPPORTED_CHARSET`, `UNSUPPORTED_CONTENT_ENCODING`                          | Unsupported request encoding                                     |
| `502`  | `UPSTREAM_ERROR`, `NAVIGATION_BLOCKED`, `DATA_API_*`                           | Webapp non-2xx response, cross-origin redirect, Data API failure |
| `503`  | `QUEUE_FULL`, `QUEUE_WAIT_TIMEOUT`, `QUEUE_CLOSED`, `RENDER_BUSY`              | Capacity limit reached (`Retry-After: 5` header set)             |
| `504`  | `RENDER_TIMEOUT`, `DATA_API_TIMEOUT`                                           | Chromium render or upstream Data API timed out                   |
| `500`  | `INTERNAL_ERROR`, `INVALID_TEMPLATE`                                           | Unexpected error or broken source `.pptx` template               |
