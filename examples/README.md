# Examples

Run commands from the repository root. Choose the group you need:

| Folder                               | Purpose                                                               | Start here                                      |
| ------------------------------------ | --------------------------------------------------------------------- | ----------------------------------------------- |
| [pdf/](pdf/)                         | HTML source, PDF request examples, and programmatic PDF rendering     | [PDF guide](pdf/README.md)                      |
| [pptx/](pptx/)                       | Generated decks, JSZip template filling, and placeholder replacements | [PPTX guide](pptx/README.md)                    |
| [data-api/single/](data-api/single/) | Fetch one report                                                      | `npm run example:fetch-data -- id2222 en 2026`  |
| [data-api/chain/](data-api/chain/)   | Use one response to request another                                   | `npm run example:fetch-chain -- id2222 en 2026` |
| [data-api/batch/](data-api/batch/)   | Fetch an ID list, then collect reports by ID                          | `npm run example:fetch-batch -- dict en 2026`   |
| [data-api/server/](data-api/server/) | Synthetic API shared by the data examples                             | `npm run demo:data-api`                         |

## Data API examples

Start with **single**, then read **chain** or **batch** when you need them. Each folder contains `fetch.ts`, the runnable script. Chain and batch also contain `collect.ts`, the reusable request workflow.

In one terminal, start the demo API:

```bash
npm run demo:data-api
```

In another, run your chosen example:

```bash
DATA_API_BASE_URL=http://localhost:3002/api npm run example:fetch-data -- id2222 en 2026
DATA_API_BASE_URL=http://localhost:3002/api npm run example:fetch-chain -- id2222 en 2026
DATA_API_BASE_URL=http://localhost:3002/api npm run example:fetch-batch -- dict en 2026
```

To fetch data from the Data API and directly populate `templates/daa.pptx` (filling its table, chart, and title), run:

```bash
DATA_API_BASE_URL=http://localhost:3002/api npm run example:data-to-pptx -- id2222 en 2026
```

Results go to `output/data-api/`. Batch also accepts `list` instead of `dict`; both retain the requested ID. A failed request stops collection and no new output file is written.

Endpoint paths and response schemas are configured in [src/data-api/](../src/data-api/).

## Document requests

With Generator API running (`npm run dev`):

```bash
# Generated PowerPoint presentation from JSON specification
curl -X POST http://localhost:3000/pptxgenjs/brief -H 'Content-Type: application/json' --data-binary @examples/pptx/generated.json -o brief.pptx

# PPTX template filled with native table, chart, and custom title text
curl --fail-with-body 'http://localhost:3000/pptx/daa?TEXT_ME=Quarterly%20Review' -o demo-report.pptx

# PPTX template demo using Tmp1.pptx
curl --fail-with-body 'http://localhost:3000/pptx/tma?TEXT_ME=Performance' -o tma.pptx

# Fixed quarterly report PDF (requires demo webapp running via `npm run demo`)
curl --fail-with-body 'http://localhost:3000/pdf/quarterly?year=2026&quarter=3&language=en' -o quarterly.pdf

# Factsheet PDF for a document ID (portrait)
curl --fail-with-body http://localhost:3000/pdf/factsheet/id2222 -o factsheet.pdf

# Onepager PDF for a document ID (landscape, with optional date range and benchmark)
curl --fail-with-body 'http://localhost:3000/pdf/onepager/id2222?START=2026-01-01&END=2026-12-31&BENCHMARK=SAA' -o onepager.pdf
```

For PDF file roles, query parameters, and orientations, see [pdf/README.md](pdf/README.md). PDF generation from webapp pages needs the demo webapp (`npm run demo`).

Distant source imports use `@/` for `src/` (for example `@/config`), and tests can use `@examples/` for example modules. Aliases omit file extensions; nearby imports remain relative with `.ts`.

## Fill a PPTX template

Run `npm run example:fill-template` to produce `output/filled-template.pptx`.
Start with the [one-operation JSZip examples](pptx/jszip/README.md).
See [pptx/README.md](pptx/README.md) for slide operations, chart filling, paragraph
replacement, token placeholders, and 2D table resizing.
