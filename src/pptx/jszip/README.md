# JSZip PowerPoint template utilities

Use these functions to fill an existing `.pptx` while retaining native editable
objects. Start with [one-operation examples](../../../examples/pptx/jszip/README.md)
and run `npm run test:jszip` for tests grouped by utility.

Load/save ZIP bytes directly with JSZip; edit simple XML attributes directly with
the DOM. Complex operations below keep formatting and related package parts together.
Always write a new output file rather than overwriting the source template.

## Functionality

| Module                                                           | Utility                                              | Use                                                                                                                                                                 |
| ---------------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [objects.ts](objects.ts)                                         | `findNamedObjects(zip, names, slidePaths?)`          | Find Selection Pane names, optionally within specific active slides; reject missing or ambiguous matches. Returns object handles and parsed slide XML.              |
| [text/fill-shape.ts](text/fill-shape.ts)                         | `fillTextShape(element, text)`                       | Set whole-shape text using its first run's style.                                                                                                                   |
| [text/replace-paragraph-text.ts](text/replace-paragraph-text.ts) | `replaceParagraphText(element, search, replacement)` | Replace literal text within paragraphs, including matches split across formatted runs. Returns the replacement count.                                               |
| [text/fill-paragraphs.ts](text/fill-paragraphs.ts)               | `fillParagraphs(element, strings)`                   | Fill paragraphs/bullets; clone the last paragraph when growing and remove excess paragraphs when shrinking.                                                         |
| [placeholders.ts](placeholders.ts)                               | `replacePlaceholders(zip, replacements)`             | Fill `{{key}}` tokens in active slides and their notes. Reject missing replacement keys and supplied keys absent from the template. Saves changed parts.            |
| [tables/fill.ts](tables/fill.ts)                                 | `fillTable(element, rows, options)`                  | Fill cells; `startRow: 1` keeps the header and `resizeRows: true` grows/shrinks rows with matching styles and adjusts frame height.                                 |
| [charts.ts](charts.ts)                                           | `fillCategoryChart(zip, object, rows, options)`      | Fill line, bar/column, area, pie, doughnut and radar charts, synchronizing caches, formulas, embedded worksheet cells and table ranges. Saves chart/workbook parts. |
| [slides/list.ts](slides/list.ts)                                 | `listSlides(zip)`                                    | Get active slide paths in presentation order, including hidden slides.                                                                                              |
| [slides/duplicate.ts](slides/duplicate.ts)                       | `duplicateSlide(zip, path)`                          | Insert a copy after its source with independent charts, embedded workbooks and notes. Share layouts/media. Return the copied slide path.                            |
| [slides/remove.ts](slides/remove.ts)                             | `removeSlide(zip, path)`                             | Remove the deck entry and custom-show/section references; keep at least one slide. Retain package assets to preserve shared relationships.                          |
| [spreadsheet.ts](spreadsheet.ts)                                 | `setWorksheetCell(document, address, value)`         | Set workbook cell content, creating missing rows/cells and retaining styles.                                                                                        |
| [package/](package/)                                             | `readXml`, `writeXml`, `resolveRelationship`         | Read/write XML and follow typed internal relationships using `read-xml.ts`, `write-xml.ts` and `resolve-relationship.ts`.                                           |

The chart implementation is split into [charts/](charts/): `cache.ts` updates
cached points, `categories.ts` resolves category caches and Excel date serials, `ranges.ts` resizes formulas and clears obsolete cells, `series.ts`
fills values/categories/titles, `load-workbook.ts` loads worksheets, `resize-workbook-tables.ts` resizes Excel
tables, and `types.ts` defines options. Helpers in `charts/workbook/` each handle one step: cell addresses, worksheet bounds, column names, dimensions, table-column names, or table resizing. Use `fillCategoryChart` as the entry point.

The placeholder coordinator remains in `placeholders.ts`; its helpers live in `placeholders/`: `find-text-parts.ts`, `replace-paragraph-tokens.ts`, `replace-token-across-runs.ts`, and `validate-replacement-usage.ts`, with shared types in `types.ts`. The worksheet cell entry point in `spreadsheet.ts` delegates ordered row/cell lookup and cell-value writing to `spreadsheet/`: `find-or-create-row.ts`, `find-or-create-cell.ts`, and `write-cell-value.ts`.

Operations are grouped in `text/`, `tables/`, `slides/`, `package/` and `charts/`.
Import directly from the operation's file. Shared implementations live alongside
these operations: `text/set-text.ts` retains run formatting, `tables/resize-rows.ts`
resizes styled rows, `slides/deck.ts` reads presentation order, and
`slides/copy-parts.ts` copies dependent parts. `package/namespaces.ts` contains XML
namespace constants and `package/invalid-template.ts` creates template errors.

## Minimal text example

```ts
import { readFile, writeFile } from 'node:fs/promises';

import JSZip from 'jszip';

import { findNamedObjects } from '@/pptx/jszip/objects';
import { writeXml } from '@/pptx/jszip/package/write-xml';
import { fillTextShape } from '@/pptx/jszip/text/fill-shape';

const zip = await JSZip.loadAsync(await readFile('templates/daa.pptx'));
const { objects, slides } = await findNamedObjects(zip, ['TEXT_ME']);
fillTextShape(objects.get('TEXT_ME')!.element, 'Quarterly results');
for (const [path, document] of slides) writeXml(zip, path, document);
await writeFile('report.pptx', await zip.generateAsync({ type: 'nodebuffer' }));
```

Text, paragraph and table utilities mutate parsed XML: save those slide documents
with `writeXml`. Chart, placeholder and slide operations save their own parts.
Finish/save XML edits before looking up the same slide again. Duplicate slides
before lookup, then scope lookup to the returned path when names repeat.

For tables, `startRow` and `startColumn` are zero-based offsets, both defaulting
to `0`. Use `startColumn: 1` to preserve first-column headers, or combine it with
`startRow: 1` to preserve both the top row and first column:

```ts
fillTable(table.element, [['100', '200', '300']], {
  startRow: 1,
  startColumn: 1,
});
```

Each data row must fill all columns from `startColumn` to the table's end, unless
`resizeColumns: true` adjusts the column count. Data must fill all rows from
`startRow`, unless `resizeRows: true` adjusts the row count. Enable both options
to resize both dimensions. Column resizing requires nonempty, rectangular data.
When growing rows, the last row is cloned, including its preserved column headers;
new header labels therefore repeat the last row's labels.
When growing columns, the last column's cells and width are cloned across every
row, including header rows. New header labels repeat the last column's labels.
Shrinking removes trailing columns. Table frame width adjusts with column widths,
just as frame height adjusts when rows resize. Preserved rows retain existing
cells, but gain or lose trailing cells to match the new column count.

## Limits and options

Chart rows represent categories; columns represent the template's existing series.
Pass `categories` when changing row count; pass `seriesNames` to rename series and
workbook headers. Defaults: `sheetName: 'Sheet1'`, `firstColumn: 'B'`, `firstRow: 2`;
categories use the previous column. Quoted worksheet names and columns beyond Z
are supported. Existing series count and styling are retained.

After resizing a chart, existing worksheet dimensions are recomputed from every
retained cell, including formatted empty cells. Unrelated worksheet data remains
inside the used range even when the chart shrinks. Worksheets without a dimension
retain that valid optional omission.

Combination, scatter, bubble, 3D, external-workbook and genuinely multilevel-category
charts are unsupported. A single category level encoded as `multiLvlStrCache` is
supported. Create/change chart types in PowerPoint. Merged tables cannot be resized.
Duplicated slides are not automatically added to sections/custom shows. Removing a
slide retains unused ZIP assets, so it does not necessarily reduce the file size.

## Services using these utilities

[PowerPointTemplateService](../../services/jszip/power-point-template-service.ts) loads templates from a registry
and returns placeholder-filled PPTX bytes.
[DaaPocPresentationService](../../services/jszip/daa-poc-presentation-service.ts) demonstrates filling the named
`TAB100`, `GGO` and `TEXT_ME` objects in `templates/daa.pptx`.
