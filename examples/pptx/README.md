# PowerPoint generation and template filling

Generator API supports two complementary approaches to creating PowerPoint presentations:

1. **Generated presentations (PptxGenJS)**: Code generates new slides from scratch using customizable layouts (e.g., the `brief` report).
2. **Template filling (JSZip)**: Code mutates authored `.pptx` decks while preserving PowerPoint's native, editable shapes, tables, and charts.

## Programmatic deck generation (PptxGenJS)

Generate a presentation directly from a JSON specification using `PowerPointGenerationService`:

```bash
npm run example:pptx:brief
```

This reads [generated.json](generated.json) and writes `output/pptx/quarterly-review.pptx`. You can also post this specification to the running API server:

```bash
curl -X POST http://localhost:3000/pptxgenjs/brief \
  -H 'Content-Type: application/json' \
  --data-binary @examples/pptx/generated.json \
  -o brief.pptx
```

## Template filling with JSZip

Start with the [small JSZip examples](jszip/README.md), each focused on one operation.
The [utility reference](../../src/pptx/jszip/README.md) lists all available functions.

Run `npm run example:fill-template` from the project root. The example reads
`templates/daa.pptx` and writes `output/filled-template.pptx`. It duplicates a
slide, fills the copy's chart/table/text, then removes the original from the deck.
The source file is never overwritten.

To fill token placeholders (`{{title}}`, `{{subtitle}}`, `{{customer}}`) in a template using [template.json](template.json), run:

```bash
npm run example:pptx:placeholders
```

This writes `output/jszip/placeholders.pptx`. [create-template.ts](create-template.ts) demonstrates how the source template with placeholders was created.

### Working with named shapes

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
| Template tokens     | `replacePlaceholders(zip, replacements)`             | Replaces `{{key}}` tokens across slides and notes; rejects missing or unused keys. See `npm run example:pptx:placeholders`.                                                               |
| Table values & 2D   | `fillTable(element, rows, options)`                  | `startRow: 1` preserves the header row. `resizeRows: true` and `resizeColumns: true` adjust row/column counts and table frame dimensions. Merged tables cannot be resized.                |

Text/table operations edit the parsed XML. Save it with `writeXml`:

```ts
for (const [path, document] of slides) writeXml(zip, path, document);
const bytes = await zip.generateAsync({
  type: 'nodebuffer',
  compression: 'DEFLATE',
});
```

Chart operations save their own chart and workbook parts. Duplicate before looking
up objects; finish/save XML edits before looking up the same slide again.
