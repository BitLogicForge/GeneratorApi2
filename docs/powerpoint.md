# PowerPoint generation and templates

[Back to overview](../README.md)

## Edit an existing PowerPoint template

`GET/POST /api/exports/pptx/jszip/summary` fills the existing
`templates/summary.pptx` with `title`, `subtitle`, and `customer` replacements,
using the same contract as the business route. See [the endpoint example](endpoints.md#getpost-apiexportspptxjszipsummary).

`POST /api/exports/pptx/jszip/business` reads a registered `.pptx` file and modifies its text directly. The included `business` template is `templates/business.pptx`.

```bash
curl -X POST http://localhost:3000/api/exports/pptx/jszip/business \
  -H 'Content-Type: application/json' \
  --data-binary @examples/pptx/template.json --output proposal.pptx
```

In PowerPoint, add placeholders such as `{{title}}`, `{{subtitle}}`, and `{{customer}}` to text boxes or table cells. Supply matching strings in the JSON `replacements` object. Placeholders can span formatting runs within a paragraph; replacement text inherits the formatting of the first run. Speaker-note placeholders are also replaced. Replacements are literal text, with XML characters escaped automatically. Missing replacements and unknown keys return 400, so spelling errors do not silently produce incomplete decks.

Register your own files in `templates/catalog.json` as described below. The registry accepts trusted server-side files; callers cannot supply filesystem paths. Include the `templates` directory, including `catalog.json`, beside `dist` in your deployment. Each request loads a fresh copy and never changes the original template. The included sample can be recreated with `npx tsx examples/pptx/create-template.ts`.

Only slide and speaker-note text is changed. Untouched ZIP parts, including media, masters, layouts, charts, and relationships, are preserved. This endpoint supports modern `.pptx`, not legacy `.ppt`. Placeholders in masters, layouts, chart data, or across paragraphs are not supported. Replacement strings are single-paragraph text; layout and text-box sizing remain the template author's responsibility. This initial manipulation service does not resize images, update chart data, or add/remove slides. It shares the existing PowerPoint queue and concurrency limit.

## Catalog and preflight

`GET /api/templates` lists registered file templates with their ID, version,
description, export URL, methods, supported editing features, request JSON
Schema, placeholders, named slide objects, chart types, and preflight warnings.
Server-side filenames and filesystem paths are excluded. The schema describes
incoming data, including defaults; XML character restrictions also apply to text
and are described in `textConstraints`.

To register another text template:

1. Put the `.pptx` file in `templates/` and author slide or speaker-note
   placeholders such as `{{title}}`.
2. Add an entry to `templates/catalog.json`:

   ```json
   {
     "id": "quarterly",
     "version": "1.0.0",
     "description": "Quarterly customer report",
     "file": "quarterly.pptx",
     "mode": "placeholders",
     "requiredPlaceholders": ["title", "customer"]
   }
   ```

3. Run `npm run templates:preflight`. It prints discovered metadata as JSON
   and exits nonzero when validation fails.
4. Restart or deploy the API. The template appears in `/api/templates` and
   supports GET/HEAD/POST at `/api/exports/pptx/jszip/quarterly` without a new
   route file. Send `replacements` for **every discovered placeholder**; the
   explicit `requiredPlaceholders` list is an authoring check, not an optional
   subset of request fields.

Dropping a file into the directory alone does not register it. IDs, versions,
descriptions, and workflow requirements are authored in the catalog; inspection
gathers structure from the PPTX. Registration uses simple local `.pptx` filenames.
The API loads metadata once at startup, so file changes require a restart.

Preflight checks the presentation structure, XML, internal relationship targets
and references, and declared placeholders. Required named objects must exist
uniquely with the declared kind; table dimensions and editable category charts
are checked, including their workbook and formula support. Duplicate names for
other objects produce warnings because PowerPoint commonly repeats default
names across slides. Unsupported chart types produce warnings when preserved
by text workflows, and fail if required for editing. External relationships
are preserved without fetching their targets. Preflight does not render slides
or validate visual layout.

The `daa-demo` mode is reserved for the existing DAA workflow and also exercises
its real generation service with deterministic data. Its catalog entry declares
the required named objects. Adding another custom chart/table workflow still
requires an injected service and handler; inspection cannot infer business
logic or request data semantics from a presentation.

The same catalog drives startup wiring and validation. Invalid templates stop
startup before listening. Preflight also runs in CI and Azure packaging, before
deployment. Checks use in-memory copies and never modify source presentations.

## Template report demo

Open `http://localhost:3000/api/exports/pptx/jszip/daa` to download `templates/daa.pptx` populated with random integers from 1–100. No parameters are required. The objects are found by their Selection Pane names: `TAB100` (table), `GGO` (chart), and `TEXT_ME` (text). Set the text with `http://localhost:3000/api/exports/pptx/jszip/daa?TEXT_ME=Hello%20world`; omitting `TEXT_ME` uses `Generated report`. The value accepts up to 5,000 characters and is inserted as literal text, preserving the first text run’s formatting. Object names must be unique across the presentation. The chart and embedded workbook are located through their relationships, so object order and chart filenames may change. The table must remain 4×4 and the chart must retain its three-series data layout. The first table row stays unchanged as the header; only the last three rows receive random values. The line chart receives a separate set of 20 random rows across three series, with category labels `A1`–`A20`. Series names and template styling stay as authored. The embedded Excel workbook and chart cache are updated together, keeping **Edit Data** available in PowerPoint. The source file remains unchanged, and generation shares the PowerPoint queue.

Run `npm run test:outputs` to save a sample to `output/routes/demo-report.pptx` along with the other route outputs.

Reusable template helpers live in `src/pptx/jszip`: `objects.ts` finds uniquely named shapes across slides; `text/` fills text and paragraphs; `tables/` fills and resizes tables; `slides/` lists, duplicates and removes slides; `charts.ts` coordinates category-chart filling, with cache, range, series and workbook logic in `charts/`; `package/` reads/writes XML parts and resolves file relationships. `DaaPocPresentationService` supplies the object names and random data, then calls these helpers. The chart helper resizes numeric ranges (default `Sheet1`, starting at `B2`), chart caches, worksheet rows, and the embedded Excel table range. Pass `categories` when changing the number of rows; series count must match the template. Series names and styles are preserved.

## JSZip template utilities

See [the JSZip utility reference](../src/pptx/jszip/README.md),
[small examples](../examples/pptx/jszip/README.md), and run
`npm run example:fill-template` for a complete duplicate → fill → remove example.
