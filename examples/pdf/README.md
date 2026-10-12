# PDF examples

Generator API runs on port 3000. The demo HTML webapp runs on port 3001; Chromium converts its pages into PDF.

## Start the API and webapp

Run `npm run dev` and `npm run demo` in separate terminals. The default `WEBAPP_BASE_URL` is `http://localhost:3001`.

## Factsheet and onepager

```bash
curl --fail-with-body 'http://localhost:3000/api/exports/pdf/factsheet/id2222?language=en' --output factsheet.pdf
curl --fail-with-body 'http://localhost:3000/api/exports/pdf/onepager/id2222?language=de&year=2027' --output onepager.pdf
```

The factsheet endpoint renders `/factsheet/id2222` and forces portrait. Onepager renders `/onepager/id2222` and forces landscape. Their API paths have no `.pdf` suffix; attachment filenames are `id2222.pdf`.

Both accept only validated `language` and `year`. Unknown or repeated parameters return 400. HEAD returns attachment metadata without rendering. The demo document pages show the ID; they demonstrate forwarding language/year without translating the text.

External page patterns and default language live in `src/reports/document/settings.ts`. The shared `src/reports/document/report.ts` validates input, selects the corresponding external path, and applies the endpoint's orientation.

## Quarterly report

[quarterly-portrait.json](quarterly-portrait.json) and [quarterly-landscape.json](quarterly-landscape.json) select the same quarterly page with different print orientations:

```bash
curl --fail-with-body http://localhost:3000/api/exports/pdf/test -H 'Content-Type: application/json' --data-binary @examples/pdf/quarterly-portrait.json --output quarterly-report-portrait.pdf
curl --fail-with-body http://localhost:3000/api/exports/pdf/test -H 'Content-Type: application/json' --data-binary @examples/pdf/quarterly-landscape.json --output quarterly-report-landscape.pdf
curl --fail-with-body 'http://localhost:3000/api/exports/pdf/portrait/quarterly?year=2027&quarter=2&language=pl' --output quarterly-2027-q2-pl.pdf
```

The fixed quarterly endpoint renders `/reports/quarterly`, accepts year 2000–2100, quarter 1–4, and language en/de/pl, and waits for `[data-report-ready]`. Its schema and page settings live together in `src/routes/api/exports/pdf/portrait/quarterly/report.ts`.

## Where to edit

| Responsibility                                     | File                               |
| -------------------------------------------------- | ---------------------------------- |
| Demo HTML pages                                    | [webapp.ts](webapp.ts)             |
| Document external paths and default language       | `src/reports/document/settings.ts` |
| Document ID/query validation and page resolution   | `src/reports/document/report.ts`   |
| Shared print defaults                              | `src/config/defaults.ts`           |
| PDF input and print-setting validation             | `src/services/pdf/contracts.ts`    |
| Shared report handler                              | `src/reports/pdf.ts`               |
| Chromium, navigation boundary, readiness, printing | `src/services/pdf/web-page-pdf.ts` |

See [the PDF guide](../../docs/pdf.md) for readiness and [the endpoint workflow](../../docs/development.md#add-a-pdf-endpoint) for adding a report.

## Generate verified artifacts

Run `npm run test:outputs`. It starts isolated servers and writes PDFs and editable PowerPoint examples under `output/routes/`. The factsheet cases retain `document-portrait.pdf` and `document-portrait-de.pdf` output filenames; the onepager case retains `document-landscape.pdf`. Other PDFs cover quarterly portrait/landscape and custom Letter output. `manifest.json` records request URLs, filenames, and byte sizes.
