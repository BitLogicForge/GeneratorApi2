# API endpoint examples

Start the API with `npm run dev`. For PDF examples, start the webapp with `npm run demo` in another terminal.

| Method    | Route                                | Result                                     |
| --------- | ------------------------------------ | ------------------------------------------ |
| GET       | /health                              | `{ "status": "ok" }`                       |
| GET       | /:id.pdf                             | PDF of the configured document route       |
| GET, POST | /api/exports/pdf                     | PDF of a supplied webapp route             |
| GET, POST | /api/exports/pptx/generated/brief    | Generated presentation                     |
| GET, POST | /api/exports/pptx/templates/business | Presentation with placeholder replacements |
| GET       | /demo-report.pptx                    | Native table/chart demo                    |

GET text fields are passed directly. Encode `query` and `replacements` as JSON objects, `slides` as a JSON array, and `landscape` as a JSON boolean. POST requests use JSON bodies. Inputs are used directly without runtime validation.

## Document PDF

```bash
curl 'http://localhost:3000/id2222.pdf?language=en' --output document.pdf
```

The default route is `/documents/{id}`. Query parameters are forwarded to the webapp, with `language=en` added when no language is supplied in the route or request.

## Custom PDF

```bash
curl http://localhost:3000/api/exports/pdf \
  -H 'Content-Type: application/json' \
  -d '{"route":"/reports/quarterly","query":{"year":2026,"quarter":3},"filename":"quarterly"}' \
  --output quarterly.pdf
```

Supply `route`. Optional fields are `query` (default `{}`), `filename` (default `document`), `format` (default `A4`), `landscape` (default `false`), and `waitForSelector`.

## Generated presentation

```bash
curl http://localhost:3000/api/exports/pptx/generated/brief \
  -H 'Content-Type: application/json' \
  -d '{"title":"Quarterly review","slides":[{"title":"Results","bullets":["Revenue grew","Projects delivered"]}]}' \
  --output presentation.pptx
```

Supply `title` and `slides`, with a title and bullets for each slide. Slide notes are optional. Defaults are `filename: presentation`, `subtitle: ""`, `author: Generator API`, and `accent: 2563EB`.

## File template presentation

```bash
curl http://localhost:3000/api/exports/pptx/templates/business \
  -H 'Content-Type: application/json' \
  -d '{"replacements":{"title":"Quarterly review","subtitle":"Q3 2026","customer":"Acme"}}' \
  --output business.pptx
```

Supply `replacements` using keys without braces. `title` replaces `{{title}}`. The default filename is `presentation`. Text replacements preserve the existing template layout.

## Table and chart demo

```bash
curl 'http://localhost:3000/demo-report.pptx?TEXT_ME=Hello%20world' --output demo-report.pptx
```

`TEXT_ME` defaults to `Generated report`. The presentation contains random table and chart values and an editable embedded Excel workbook.

Generated files are returned as attachments with PDF or PowerPoint content types. Unexpected failures use Express’s default error handling.
