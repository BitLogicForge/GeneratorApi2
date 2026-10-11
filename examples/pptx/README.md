# Filling PowerPoint templates with JSZip

Run `npm run example:fill-template` from the project root. The example reads
`templates/daa.pptx` and writes `output/filled-template.pptx`. It duplicates a
slide, fills the copy's chart/table/text, then removes the original from the deck.
The source file is never written.

Name objects in PowerPoint's Selection Pane, then look them up by those names.
Use slide paths returned by `listSlides` and `duplicateSlide` as handles:

```ts
const copy = await duplicateSlide(zip, (await listSlides(zip))[0]);
const { objects, slides } = await findNamedObjects(zip, ['Revenue'], [copy]);
await fillCategoryChart(zip, objects.get('Revenue')!, [[10], [20]], {
  categories: ['January', 'February'],
});
```

| Operation           | Utility                                              | Behavior                                                                                                                                                                                  |
| ------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Deck order          | `listSlides(zip)`                                    | Returns active slide paths in presentation order, including hidden slides.                                                                                                                |
| Duplicate           | `duplicateSlide(zip, path)`                          | Inserts after the source; copies charts, embedded workbooks and notes; shares layouts and media. Returns the new slide path.                                                              |
| Remove              | `removeSlide(zip, path)`                             | Removes the deck entry and custom-show/section references. Requires at least one slide to remain. Retains unused package parts to protect shared assets and links.                        |
| Named lookup        | `findNamedObjects(zip, names, [path])`               | Scope names to the copied slide. Global lookup rejects ambiguous names.                                                                                                                   |
| Category charts     | `fillCategoryChart(zip, object, rows, options)`      | Line, bar/column, area, pie, doughnut and radar. Each row is one category; each column is one existing series. Updates caches, formulas, worksheet cells and Excel table ranges together. |
| Whole text shape    | `fillTextShape(element, text)`                       | Uses the first run's style and clears other text runs.                                                                                                                                    |
| Paragraphs/bullets  | `fillParagraphs(element, strings)`                   | Preserves existing paragraph styles; clones the last paragraph when growing and removes excess paragraphs when shrinking.                                                                 |
| Literal replacement | `replaceParagraphText(element, search, replacement)` | Replaces every occurrence within paragraphs, including matches split across runs. Returns the replacement count. Keeps other text and formatting.                                         |
| Template tokens     | `replacePlaceholders(zip, replacements)`             | Existing `{{key}}` replacement across slides and notes; rejects missing or unused keys.                                                                                                   |
| Table values        | `fillTable(element, rows, options)`                  | `startRow: 1` preserves the header. `resizeRows: true` clones/removes data rows and adjusts frame height. Merged tables cannot be resized.                                                |

Text/table operations edit the parsed XML. Save it with the existing `writeXml`:

```ts
for (const [path, document] of slides) writeXml(zip, path, document);
const bytes = await zip.generateAsync({
  type: 'nodebuffer',
  compression: 'DEFLATE',
});
```

Chart operations save their own chart and workbook parts. Duplicate before looking
up objects; finish/save XML edits before looking up the same slide again.

Charts retain their authored series count and formatting. Options default to
`sheetName: 'Sheet1'`, `firstColumn: 'B'`, `firstRow: 2`; categories occupy the
previous column. Supply `categories` when resizing data and `seriesNames` to
rename series and workbook headers. Quoted worksheet names and columns beyond Z
are supported. Existing categories can be reused when the row count stays equal.
Combination, scatter, bubble, 3D, linked external workbooks and multilevel-category
charts are rejected. These utilities fill existing charts; create or change chart
types in PowerPoint. Duplicated slides are not automatically added to custom shows
or sections. Slide removal retains package parts rather than shrinking file size.

Simple ZIP reading/writing and direct XML attribute edits continue to use JSZip
and the DOM directly; no additional service class or ZIP wrapper is required.
