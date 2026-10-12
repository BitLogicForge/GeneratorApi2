# PDF examples

Generator API runs on port 3000. The demo HTML webapp runs on port 3001; Chromium converts its pages into PDF.

## Start the API and webapp

Run `npm run dev` and `npm run demo` in separate terminals. The default `WEBAPP_BASE_URL` is `http://localhost:3001`.

## Factsheet and onepager

```bash
curl --fail-with-body 'http://localhost:3000/pdf/factsheet/id2222?language=en' --output factsheet.pdf
curl --fail-with-body 'http://localhost:3000/pdf/onepager/id2222?START=2027-01-01&END=2027-12-31&BENCHMARK=SAA' --output onepager.pdf
```

The factsheet endpoint renders `/factsheet/id2222` and forces portrait. Onepager renders `/onepager/id2222` and forces landscape. Their API paths have no `.pdf` suffix; attachment filenames are `id2222.pdf`.

Factsheet accepts validated `language` and `year`; onepager instead accepts optional `START` and `END` as valid `YYYY-MM-DD` dates, and `BENCHMARK` as `SAA` or `REPORTING`. Onepager forwards those uppercase names unchanged and rejects `language` and `year`. Unknown or repeated parameters return 400. HEAD returns attachment metadata without rendering. The demo document pages show the ID; they demonstrate query forwarding without translating the text.

Each endpoint folder owns a `schema.ts` for path/query validation and a `report.ts` for the external page, default language, explicit parameter mapping, and orientation. See `src/routes/pdf/onepager/[id]/` and `src/routes/pdf/factsheet/[id]/`.

## Quarterly report

[quarterly-portrait.json](quarterly-portrait.json) and [quarterly-landscape.json](quarterly-landscape.json) select the same quarterly page with different print orientations:

```bash
curl --fail-with-body http://localhost:3000/pdf/test -H 'Content-Type: application/json' --data-binary @examples/pdf/quarterly-portrait.json --output quarterly-report-portrait.pdf
curl --fail-with-body http://localhost:3000/pdf/test -H 'Content-Type: application/json' --data-binary @examples/pdf/quarterly-landscape.json --output quarterly-report-landscape.pdf
curl --fail-with-body 'http://localhost:3000/pdf/quarterly?year=2027&quarter=2&language=pl' --output quarterly-2027-q2-pl.pdf
```

The fixed quarterly endpoint renders `/reports/quarterly`, accepts year 2000–2100, quarter 1–4, and language en/de/pl, and waits for `[data-report-ready]`. Its schema and page settings live in `schema.ts` and `report.ts` under `src/routes/pdf/quarterly/`.

## Where to edit

| Responsibility                                     | File                                                     |
| -------------------------------------------------- | -------------------------------------------------------- |
| Demo HTML pages                                    | [webapp.ts](webapp.ts)                                   |
| Document external paths and default language       | Each document route folder's `report.ts`                 |
| Document ID/query validation and page resolution   | Each document route folder's `schema.ts` and `report.ts` |
| Shared print defaults                              | `src/config/defaults.ts`                                 |
| PDF input and print-setting validation             | `src/services/pdf/contracts.ts`                          |
| Shared report handler                              | `src/reports/pdf.ts`                                     |
| Chromium, navigation boundary, readiness, printing | `src/services/pdf/web-page-pdf.ts`                       |

See [the PDF guide](../../docs/pdf.md) for readiness and [the endpoint workflow](../../docs/development.md#add-a-pdf-endpoint) for adding a report.

## Generate verified artifacts

Run `npm run test:outputs`. It starts isolated servers and writes PDFs and editable PowerPoint examples under `output/routes/`. The factsheet cases retain `document-portrait.pdf` and `document-portrait-de.pdf` output filenames; the onepager case retains `document-landscape.pdf`. Other PDFs cover quarterly portrait/landscape and custom Letter output. `manifest.json` records request URLs, filenames, and byte sizes.
