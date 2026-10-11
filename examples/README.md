# Examples

Run commands from the repository root. Choose the group you need:

| Folder                               | Purpose                                      | Start here                                                         |
| ------------------------------------ | -------------------------------------------- | ------------------------------------------------------------------ |
| [pdf/](pdf/)                         | Local webapp and PDF request body            | `npm run demo`, then use `pdf/request.json` with the Generator API |
| [pptx/](pptx/)                       | Generated deck and template request bodies   | `pptx/generated.json` or `pptx/template.json`                      |
| [data-api/single/](data-api/single/) | Fetch one report                             | `npm run example:fetch-data -- id2222 en 2026`                     |
| [data-api/chain/](data-api/chain/)   | Use one response to request another          | `npm run example:fetch-chain -- id2222 en 2026`                    |
| [data-api/batch/](data-api/batch/)   | Fetch an ID list, then collect reports by ID | `npm run example:fetch-batch -- dict en 2026`                      |
| [data-api/server/](data-api/server/) | Synthetic API shared by the data examples    | `npm run demo:data-api`                                            |

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

Run only the command you need. Results go to `output/data-api/`. Batch also accepts `list` instead of `dict`; both retain the requested ID. A failed request stops collection and no new output file is written.

Endpoint paths and response schemas are configured in [src/data-api/](../src/data-api/).

## Document requests

With Generator API running:

```bash
curl -X POST http://localhost:3000/api/exports/pdf -H 'Content-Type: application/json' --data-binary @examples/pdf/request.json -o report.pdf
curl -X POST http://localhost:3000/api/exports/pptx/generated/brief -H 'Content-Type: application/json' --data-binary @examples/pptx/generated.json -o brief.pptx
curl -X POST http://localhost:3000/api/exports/pptx/templates/business -H 'Content-Type: application/json' --data-binary @examples/pptx/template.json -o proposal.pptx
```

PDF generation needs the demo webapp (`npm run demo`). [pptx/create-template.ts](pptx/create-template.ts) recreates the business source template when explicitly run; it is not needed to try the request examples.

Distant source imports use `@/` for `src/` (for example `@/config`), and tests can use `@examples/` for example modules. Aliases omit file extensions; nearby imports remain relative with `.ts`.
