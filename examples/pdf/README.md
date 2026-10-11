# PDF examples

All exports use Generator API on port 3000 under `/api/exports/pdf`.
The demo webapp on port 3001 supplies HTML; Chromium turns that HTML into PDF.

## What each file does

| File                                                 | Role                                                                                                            | What it produces                                                                                                       |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| [webapp.ts](webapp.ts)                               | Demo HTML server, started with `npm run demo`                                                                   | `/documents/:id` supplies a simple document; `/reports/quarterly` supplies a quarterly report. This script serves HTML |
| [quarterly-portrait.json](quarterly-portrait.json)   | POST request body for `/api/exports/pdf`; selects the quarterly page, readiness marker and portrait orientation | `quarterly-report-portrait.pdf`                                                                                        |
| [quarterly-landscape.json](quarterly-landscape.json) | Same quarterly report and data with landscape orientation                                                       | `quarterly-report-landscape.pdf`                                                                                       |

The former `request.json` is now `quarterly-portrait.json`.

## Start both servers

In one terminal, start Generator API:

```bash
npm run dev
```

In another terminal, start the HTML source server:

```bash
npm run demo
```

The default `WEBAPP_BASE_URL` is `http://localhost:3001`.

## Example 1: document ID, fixed orientation

Both endpoints render `/documents/id2222` on the demo webapp. The named
orientation is forced, even if the global print configuration changes.

```bash
curl --fail-with-body 'http://localhost:3000/api/exports/pdf/portrait/id2222.pdf?language=en' --output document-portrait.pdf
curl --fail-with-body 'http://localhost:3000/api/exports/pdf/landscape/id2222.pdf?language=en' --output document-landscape.pdf
```

Document-ID endpoints accept only `language` (nonempty text, up to 100 characters)
and `year` (four digits, 2000–2100). Unknown or repeated parameters return 400.
Each route lists allowed fields in its own `schema.ts` and forwards them
explicitly in `document-pdf.ts`.

Both responses suggest the attachment filename `id2222.pdf`; `--output`
chooses separate local filenames. The demo document page does not translate
text; this example demonstrates forwarding the language parameter.

## Example 2: quarterly report, per-request options

These request bodies print `/reports/quarterly` with year 2026 and quarter 3,
and wait until `[data-report-ready]` is visible.

```bash
curl --fail-with-body http://localhost:3000/api/exports/pdf -H 'Content-Type: application/json' --data-binary @examples/pdf/quarterly-portrait.json --output quarterly-report-portrait.pdf
curl --fail-with-body http://localhost:3000/api/exports/pdf -H 'Content-Type: application/json' --data-binary @examples/pdf/quarterly-landscape.json --output quarterly-report-landscape.pdf
```

## Example 3: fixed portrait report with direct GET parameters

```bash
curl --fail-with-body 'http://localhost:3000/api/exports/pdf/portrait/quarterly?year=2027&quarter=2&language=pl' --output quarterly-2027-q2-pl.pdf
```

Generator API navigates with GET to:

```text
http://localhost:3001/reports/quarterly?year=2027&quarter=2&language=pl
```

The webapp endpoint is fixed in `src/routes/api/exports/pdf/portrait/quarterly/quarterly-report-pdf.ts`.
`year` accepts 2000–2100 (default 2026), `quarter` accepts 1–4 (default 3), and
`language` accepts en/de/pl (default en). Values are passed as query strings.
Unknown and repeated parameters are rejected. The output is always portrait and
waits for `[data-report-ready]`. The demo uses year/quarter in the heading and
translates the quarter label according to language.

## Waiting for the webapp

See [where readiness is configured](../../docs/pdf.md#where-pdf-readiness-is-configured)
for each endpoint. The document-ID portrait/landscape routes currently have no
readiness selector. The fixed quarterly route sets `[data-report-ready]` in
`quarterly-report-pdf.ts`; the POST examples supply it in their JSON bodies.
The common renderer executes the waiting logic in
`src/services/pdf/web-page-pdf.ts`.

## Shared endpoint structure

Every PDF route calls `createPdfHandler` with the same three fields:

- `schema`: validates that endpoint's input;
- `readInput`: reads GET/POST data or the document ID from the request;
- `prepareInput`: converts validated data into the shared `PdfInput` contract.

The handler handles validation and calls the common queue/download flow.
Each PDF endpoint has a `schema.ts` beside `get.ts`:

| Schema file under `src/routes/api/exports/pdf/` | Accepted input                                                 |
| ----------------------------------------------- | -------------------------------------------------------------- |
| `schema.ts`                                     | Arbitrary-page export options and the shared renderer contract |
| `portrait/[id].pdf/schema.ts`                   | Document ID plus optional language/year                        |
| `landscape/[id].pdf/schema.ts`                  | Document ID plus optional language/year                        |
| `portrait/quarterly/schema.ts`                  | Direct year, quarter and language parameters                   |

The generic endpoint passes validated `PdfInput` through directly. Its `query`
object accepts only `language`, `year`, `quarter` and `print`.
Each document route resolves its target in a separate `document-pdf.ts` next to
`get.ts`, including language defaults, reserved query checks, fixed orientation
and optional readiness settings. The quarterly route keeps its target
configuration in `quarterly-report-pdf.ts`. All use the same Chromium renderer
and central usage statistics.

## Where generation happens

| Application file                                                        | Responsibility                                                |
| ----------------------------------------------------------------------- | ------------------------------------------------------------- |
| `src/routes/api/exports/pdf/handler.ts`                                 | Shared validation, preparation and queued download flow       |
| `src/routes/api/exports/pdf/portrait/[id].pdf/document-pdf.ts`          | Resolves document input and forces portrait                   |
| `src/routes/api/exports/pdf/landscape/[id].pdf/document-pdf.ts`         | Resolves document input and forces landscape                  |
| `src/routes/api/exports/pdf/portrait/quarterly/quarterly-report-pdf.ts` | Selects the fixed quarterly webapp endpoint and print options |
| `src/routes/api/exports/pdf/portrait/quarterly/get.ts`                  | Selects quarterly schema, query reader and input resolver     |
| `src/services/pdf/web-page-pdf.ts`                                      | Uses Chromium to render HTML and create PDF bytes             |
| `src/config.ts`                                                         | Contains `documentSettings` and `pdfPrintSettings`            |
| `src/http/download.ts`, `src/http/observability.ts`                     | Queue/download handling and central usage statistics          |

## Generate verified artifacts

```bash
npm run test:outputs
```

This starts isolated servers and saves files under `output/routes/`:
`document-portrait.pdf`, `document-landscape.pdf`, `document-portrait-de.pdf`,
`quarterly-2027-q2-pl.pdf`, `quarterly-report-portrait.pdf`, `quarterly-report-landscape.pdf`, and
`custom-report.pdf` (Letter landscape with a readiness selector).
The suite also produces PPTX examples. `manifest.json` records request URLs,
output paths and sizes. These generated files are ignored by Git.
