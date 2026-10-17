# PowerPoint generation and templates

[Back to overview](../../README.md)

## Edit an existing PowerPoint template

`GET/POST /pptx/jszip/summary` fills the existing
`templates/summary.pptx` with `title`, `subtitle`, and `customer` replacements,
using the same contract as the business route. See [the endpoint example](../guides/endpoints.md#getpost-pptxjszipsummary).

`POST /pptx/jszip/business` reads a registered `.pptx` file and modifies its text directly. The included `business` template is `templates/business.pptx`.

```bash
curl -X POST http://localhost:3000/pptx/jszip/business \
  -H 'Content-Type: application/json' \
  --data-binary @examples/pptx/template.json --output proposal.pptx
```

In PowerPoint, add placeholders such as `{{title}}`, `{{subtitle}}`, and `{{customer}}` to text boxes or table cells. Supply matching strings in the JSON `replacements` object. Placeholders can span formatting runs within a paragraph; replacement text inherits the formatting of the first run. Speaker-note placeholders are also replaced. Replacements are literal text, with XML characters escaped automatically. Missing replacements and unknown keys return 400, so spelling errors do not silently produce incomplete decks.

Declare allowed fields and decoding in the route's `schema.ts`. In `report.ts`, select the trusted template with `templateService('name', 'name.pptx')`, explicitly map validated fields through `prepareInput`, and define the attachment filename there. Export `definePptxReport(report)` through the method files. The shared runtime creates and validates the service automatically; startup and dependency types need no edits. See [the shorter endpoint workflow](../guides/development.md#add-a-placeholder-powerpoint-endpoint). The registry accepts trusted server-side paths; the business route selects its fixed template and callers cannot supply filesystem paths. Include the `templates` directory beside `dist` in your deployment. Each request loads a fresh copy and never changes the original template. The included sample can be recreated with `npx tsx examples/pptx/create-template.ts`.

Only slide and speaker-note text is changed. Untouched ZIP parts, including media, masters, layouts, charts, and relationships, are preserved. This endpoint supports modern `.pptx`, not legacy `.ppt`. Placeholders in masters, layouts, chart data, or across paragraphs are not supported. Replacement strings are single-paragraph text; layout and text-box sizing remain the template author's responsibility. This initial manipulation service does not resize images, update chart data, or add/remove slides. It shares the existing PowerPoint queue and concurrency limit.

## Template report demo

Open `http://localhost:3000/pptx/jszip/daa` to download `templates/daa.pptx` populated with random integers from 1–100. No parameters are required. The objects are found by their Selection Pane names: `TAB100` (table), `GGO` (chart), and `TEXT_ME` (text). Set the text with `http://localhost:3000/pptx/jszip/daa?TEXT_ME=Hello%20world`; omitting `TEXT_ME` uses `Generated report`. The value accepts up to 5,000 characters and is inserted as literal text, preserving the first text run’s formatting. Object names must be unique across the presentation. The chart and embedded workbook are located through their relationships, so object order and chart filenames may change. The table must remain 4×4 and the chart must retain its three-series data layout. The first table row stays unchanged as the header; only the last three rows receive random values. The line chart receives a separate set of 20 random rows across three series, with category labels `A1`–`A20`. Series names and template styling stay as authored. The embedded Excel workbook and chart cache are updated together, keeping **Edit Data** available in PowerPoint. The source file remains unchanged, and generation shares the PowerPoint queue.

Run `npm run test:outputs` to save a sample to `output/routes/demo-report.pptx` along with the other route outputs.

Reusable template helpers live in `src/pptx/jszip`: `objects.ts` finds uniquely named shapes across slides; `text/` fills text and paragraphs; `tables/` fills and resizes tables; `slides/` lists, duplicates and removes slides; `charts.ts` coordinates category-chart filling, with cache, range, series and workbook logic in `charts/`; `package/` reads/writes XML parts and resolves file relationships. `DaaPocPresentationService` supplies the object names and random data, then calls these helpers. The chart helper resizes numeric ranges (default `Sheet1`, starting at `B2`), chart caches, worksheet rows, and the embedded Excel table range. Pass `categories` when changing the number of rows. Numeric/date category caches are preserved; `YYYY-MM-DD` categories are converted to Excel date serials using the embedded workbook's 1900 or 1904 date system, and chart caches and worksheet cells receive the same numbers. For text categories, labels stay strings; series count must match the template. Series names and styles are preserved.

## JSZip template utilities

See [the JSZip utility reference](../../src/pptx/jszip/README.md),
[small examples](../../examples/pptx/jszip/README.md), and run
`npm run example:fill-template` for a complete duplicate → fill → remove example.
