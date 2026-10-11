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

## Where generation happens

| Application file                                       | Responsibility                                         |
| ------------------------------------------------------ | ------------------------------------------------------ |
| `src/routes/api/exports/pdf/handler.ts`                | Decodes and validates arbitrary-page GET/POST requests |
| `src/routes/api/exports/pdf/document-handler.ts`       | Shared HTTP handler for document-ID downloads          |
| `src/routes/api/exports/pdf/portrait/[id].pdf/get.ts`  | Selects fixed portrait orientation                     |
| `src/routes/api/exports/pdf/landscape/[id].pdf/get.ts` | Selects fixed landscape orientation                    |
| `src/services/pdf/document-pdf.ts`                     | Resolves document ID, route and language defaults      |
| `src/services/pdf/web-page-pdf.ts`                     | Uses Chromium to render HTML and create PDF bytes      |
| `src/config.ts`                                        | Contains `documentSettings` and `pdfPrintSettings`     |
| `src/http/download.ts`, `src/http/observability.ts`    | Queue/download handling and central usage statistics   |

## Generate verified artifacts

```bash
npm run test:outputs
```

This starts isolated servers and saves files under `output/routes/`:
`document-portrait.pdf`, `document-landscape.pdf`, `document-portrait-de.pdf`,
`quarterly-report-portrait.pdf`, `quarterly-report-landscape.pdf`, and
`custom-report.pdf` (Letter landscape with a readiness selector).
The suite also produces PPTX examples. `manifest.json` records request URLs,
output paths and sizes. These generated files are ignored by Git.
