# PDF examples

Generator API runs on port 3000. The demo HTML webapp runs on port 3001; Chromium converts its pages into PDF.

## Start the API and webapp

Run `npm run dev` and `npm run demo` in separate terminals. The default `WEBAPP_BASE_URL` is `http://localhost:3001`.

## Factsheet and onepager

```bash
# Factsheet: portrait orientation for document ID
curl --fail-with-body http://localhost:3000/pdf/factsheet/id2222 --output factsheet.pdf

# Onepager: landscape orientation with optional date range and benchmark
curl --fail-with-body 'http://localhost:3000/pdf/onepager/id2222?START=2026-01-01&END=2026-12-31&BENCHMARK=SAA' --output onepager.pdf
```

The factsheet endpoint renders `/factsheet/{id}` and forces portrait. Its attachment filename is `{id}.pdf`. The factsheet route accepts no query parameters.

Onepager renders `/onepager/{id}` and forces landscape. Its attachment filename is `onepager-YYYY-MM-DD-HH-mm-{id}.pdf` using the request's UTC timestamp (falling back to `{id}.pdf` if the timestamped name would exceed the 80-character limit). Onepager accepts optional `START` and `END` as valid `YYYY-MM-DD` calendar dates, and `BENCHMARK` as `SAA` or `REPORTING`. Onepager forwards those uppercase parameter names to the webapp.

Unknown or repeated parameters return 400. HEAD returns attachment metadata without rendering. The demo document pages show the ID; they demonstrate query forwarding.

Each endpoint folder owns a `schema.ts` for path/query validation and a `report.ts` for the external page, explicit parameter mapping, and orientation. See `src/routes/pdf/onepager/[id]/` and `src/routes/pdf/factsheet/[id]/`.

## Quarterly report

```bash
curl --fail-with-body 'http://localhost:3000/pdf/quarterly?year=2026&quarter=2&language=pl' --output quarterly-2026-q2-pl.pdf
```

The fixed quarterly endpoint renders `/reports/quarterly` on the demo webapp, accepts `year` (2000–2100), `quarter` (1–4), and `language` (`en`, `de`, `pl`), and waits for `[data-report-ready]` before printing. Its schema and page settings live in `schema.ts` and `report.ts` under `src/routes/pdf/quarterly/`.

## External test route

```bash
curl --fail-with-body http://localhost:3000/pdf/example --output example.pdf
```

Renders `https://example.com/` as a portrait PDF named `example.pdf`. It accepts no query parameters.

## Programmatic PDF rendering

You can also render PDFs directly with Chromium without running the Express API server:

```bash
# Render using quarterly portrait configuration
npm run example:render-pdf -- examples/pdf/quarterly-portrait.json

# Render using quarterly landscape configuration
npm run example:render-pdf -- examples/pdf/quarterly-landscape.json
```

These configurations use [quarterly-portrait.json](quarterly-portrait.json) and [quarterly-landscape.json](quarterly-landscape.json), which adhere to `pdfRenderSchema` (`route`, `query`, `filename`, `waitForSelector`, `format`, `landscape`). The output files are saved to `output/pdf/`. Programmatic rendering requires the demo webapp (`npm run demo`) and Chromium (`npm run browser:install`).

## Where to edit

| Responsibility                                     | File                                     |
| -------------------------------------------------- | ---------------------------------------- |
| Demo HTML pages                                    | [webapp.ts](webapp.ts)                   |
| Document external paths and parameter mapping      | Each document route folder's `report.ts` |
| Document ID/query validation and schemas           | Each document route folder's `schema.ts` |
| Shared print defaults                              | `src/config/defaults.ts`                 |
| PDF input and print-setting validation             | `src/services/pdf/schema.ts`             |
| Shared report handler                              | `src/reports/pdf.ts`                     |
| Chromium, navigation boundary, readiness, printing | `src/services/pdf/web-page-pdf.ts`       |
