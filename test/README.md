# Tests

Run `npm test` from the project root. It recursively discovers `*.test.ts` files;
fixture helpers and the explicit artifact/Azure checks are excluded.

| Folder         | Coverage                                                                            |
| -------------- | ----------------------------------------------------------------------------------- |
| `http/`        | HTTP status, downloads, validation and error contracts                              |
| `pdf/`         | PDF URLs and real Chromium rendering                                                |
| `data-api/`    | Typed API client and ID batch collection                                            |
| `validation/`  | URL/path control characters and accepted inputs                                     |
| `queue/`       | Concurrency, cancellation, backpressure and shutdown                                |
| `pptx/jszip/`  | Template placeholders, charts, paragraphs, tables, slides and the complete workflow |
| `tooling/`     | Import rules, build aliases and Git hooks                                           |
| `integration/` | Explicit document artifact generation                                               |
| `deployment/`  | Explicit Azure package smoke test                                                   |

Run only the JSZip tests with `npm run test:jszip`. To focus on one utility:

```bash
npx --no-install tsx --test test/pptx/jszip/tables.test.ts
```

The JSZip folder groups tests by functionality. `fixtures.ts` holds shared template
loading/chart lookup; `workflow.test.ts` checks duplication followed by chart filling
and removal. Existing contract and formatting checks remain in the individual files.

`npm run test:outputs` generates documents in `output/routes/` for inspection.
`npm run test:azure` requires the package created by `npm run build:azure`.
Real PDF tests require Chromium and its system libraries.
