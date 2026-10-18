# PowerPoint Services & JSZip OpenXML Utilities

[Back to Documentation Index](../README.md)

## Generation Approaches

1. **Programmatic Generation (`src/services/pptxgenjs/`, `src/pptx/pptxgenjs/`)**:
   `PowerPointGenerationService` builds new decks from scratch with PptxGenJS
   (such as the `brief` template used by `/pptxgenjs/brief`).
2. **Template Placeholder Replacement (`src/services/jszip/power-point-template-service.ts`)**:
   Registered via `templateService(name, filename)` (`src/reports/template.ts`),
   replacing `{{key}}` tokens across slide and speaker-note paragraphs while
   preserving run formatting and rejecting missing or unused keys.
3. **Direct OpenXML Template Manipulation (`src/pptx/jszip/`)**:
   Low-level JSZip + `@xmldom/xmldom` utilities that populate named shapes,
   tables, and charts while keeping native PowerPoint **Edit Data** workbooks
   and relationships intact (used by `DaaPocPresentationService` and
   `TmxPocPresentationService`).

## JSZip OpenXML Utility Reference (`src/pptx/jszip/`)

| Module                                                                | Function                                              | Behavior                                                                                                                                                 |
| --------------------------------------------------------------------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/pptx/jszip/objects.ts`                                           | `findNamedObjects(zip, names, slides?)`               | Finds Selection Pane names (`sp`, `graphicFrame`). `objects.get(name, slide?)` and `objects.inSlide(slide)` accept a slide path or 1-based slide number. |
| `src/pptx/jszip/text/fill-shape.ts`                                   | `fillTextShape(element, text)`                        | Replaces whole-shape text using the first run's `<a:rPr>` formatting.                                                                                    |
| `src/pptx/jszip/text/fill-paragraphs.ts`                              | `fillParagraphs(element, values)`                     | Replaces body paragraphs, cloning the last paragraph's style/bullets when growing and removing extras when shrinking.                                    |
| `src/pptx/jszip/text/replace-paragraph-text.ts`                       | `replaceParagraphText(element, search, replacement)`  | Replaces literal text within paragraphs, including matches split across formatted runs.                                                                  |
| `src/pptx/jszip/placeholders.ts`                                      | `replacePlaceholders(zip, replacements)`              | Replaces `{{key}}` tokens across active slides and notes; rejects missing or unused keys and saves modified XML parts.                                   |
| `src/pptx/jszip/tables/fill.ts`                                       | `fillTable(element, rows, options?)`                  | Fills table cells from `startRow`/`startColumn`, optionally resizing rows/columns (`resizeRows`, `resizeColumns`) and setting `cellColors`.              |
| `src/pptx/jszip/charts.ts`                                            | `fillCategoryChart(zip, chartObject, data, options?)` | Updates series caches, formulas, point colors, embedded `.xlsx` worksheet cells, `<dimension>`, and Excel table ranges together.                         |
| `src/pptx/jszip/slides/list.ts`                                       | `listSlides(zip)`                                     | Returns active slide paths in presentation order.                                                                                                        |
| `src/pptx/jszip/slides/duplicate.ts`                                  | `duplicateSlide(zip, slide)`                          | Clones `slide` (path or 1-based number) after its source with independent charts, embedded workbooks, and notes; returns new path.                       |
| `src/pptx/jszip/slides/remove.ts`                                     | `removeSlide(zip, slide)`                             | Removes `slide` (path or 1-based number) and custom-show/section references while keeping at least one slide in the deck.                                |
| `src/pptx/jszip/spreadsheet.ts`                                       | `setWorksheetCell(sheet, address, value, styleRow?)`  | Sets a worksheet cell (`<v>` for numbers, `<is><t>` for strings), creating missing rows/cells in order and inheriting column styles.                     |
| `src/pptx/jszip/package/{read-xml,write-xml,resolve-relationship}.ts` | `readXml`, `writeXml`, `resolveRelationship`          | Parses/serializes XML parts (validating XML 1.0 text) and follows typed internal `.rels` targets.                                                        |

## Working with Duplicated Slides & Repeated Object Names

Text, paragraph, and table utilities mutate parsed slide `Document` nodes in
memory—persist them with `writeXml(zip, path, document)`. Chart, placeholder,
and slide operations write their own parts directly into `zip`:

```ts
const copy = await duplicateSlide(zip, 1);
const { objects, slides } = await findNamedObjects(zip, [
  'GGO',
  'TEXT_ME',
  'TAB100',
]);
const copyObjects = objects.inSlide(copy);

await fillCategoryChart(zip, copyObjects.get('GGO'), [[10, 20, 30]], {
  categories: ['Q1'],
});
fillTextShape(copyObjects.get('TEXT_ME').element, 'Quarterly results');
fillTable(copyObjects.get('TAB100').element, [[1, 2, 3, 4]], {
  startRow: 1,
  resizeRows: true,
});

for (const [path, document] of slides) writeXml(zip, path, document);
```

## Runnable Examples (`examples/pptx/`)

- `npm run example:pptx:brief` — PptxGenJS deck from `examples/pptx/generated.json`
- `npm run example:fill-template` — Duplicate slide, fill chart/table/text, remove original (`examples/pptx/jszip/workflow.ts`)
- `npm run example:pptx:chart` / `table` / `text` / `paragraphs` / `placeholders` / `duplicate-slide` / `remove-slide` — Focused single-operation scripts in `examples/pptx/jszip/`
