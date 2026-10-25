# PowerPoint Generation Roadmap

[Back to Documentation Index](../README.md)

_Written 2026-10-25. This lists ideas for extending PPTX generation, in priority
order. For what exists today, see [PowerPoint Service](../services/powerpoint.md)._

## Current capabilities

- **Text**: fill a whole shape, replace a token inside it (including text split
  across formatting runs), or replace a bullet list (`fillParagraphs`).
- **Tables**: fill from any start row or column, add or remove rows and columns
  to fit the data (`resizeRows`, `resizeColumns`), and set text colour per cell
  (`cellColors`).
- **Charts**: line, bar, area, pie, doughnut and radar. The embedded workbook
  stays in sync, so **Edit Data** works in PowerPoint. Categories, ISO dates,
  series names and per-point colours are supported.
- **Objects and slides**: move, resize, clone and delete shapes, tables, charts
  and images; duplicate slides with independent charts and notes; replace
  `{{token}}` placeholders in slides and speaker notes.
- **Pipeline**: templates are validated at startup; generation runs as
  fetch → prepare → render; generation stops when the client disconnects;
  failures produce specific error messages.

## Priority gaps

### 1. Image replacement

Images (`<p:pic>`) can be moved, cloned or deleted, but not swapped for new
content. Customer logos, maps, photos and pictures of charts need this.

**Proposal:** `images.<alias>.fill(buffer, { contentType })`. It adds the file
under `ppt/media/`, registers its content type, adds a relationship from the
slide, and points the picture's `<a:blip r:embed>` at it. Options would choose
between keeping the frame size and keeping the image's aspect ratio.

### 2. Tables that continue onto the next slide

`resizeRows` adds rows but never splits a table, so long tables run off the
slide.

**Proposal:** `tables.<alias>.fillPaginated(rows, { rowsPerSlide, repeatHeader })`.
It fills the first page, then uses `duplicateSlide` to carry the remaining rows
onto copies of the slide. It returns the slide handles so captions such as
"continued" can be set.

### 3. Conditional slides

`removeSlide` exists in `src/pptx/jszip/slides/remove.ts`, but `TemplateDeck`
doesn't expose it, and slides can't be hidden or reordered. Reports often need
"skip this section when there's no data".

**Proposal:** `deck.removeSlide(slide)`, `deck.hideSlide(slide)` (`show="0"`)
and `deck.moveSlide(slide, position)`.

### 4. More table formatting

Only text colour can be set today. Commonly needed:

- cell background colour, bold and italic per cell
- number formatting with a locale (`1 234,56`, `%`, currency)
- formatting by value, for example red text for negative numbers

**Proposal:** extend `cellColors` into a `cellStyles` matrix
(`{ color, fill, bold, italic }`) and add a `format` callback per column.

### 5. Chart flexibility

- **Charts with two chart types** (for example bars with a line on a second
  axis) are rejected; `getSingleCategoryPlot` requires exactly one.
- **Scatter and bubble charts** aren't supported.
- **Series count** must match the template exactly; series can't be added or
  removed.
- **Colours** apply per data row (right for pie charts), not per series (what
  bar and line charts need).
- **Chart title, data labels, number format and axis min/max** can't be set
  from data.

**Proposal:** support several chart types in one plot area, with each series
mapped to its own type. Add `seriesColors`, `title`, `numberFormat` and
`axis: { min, max }` options. Allow growing the series count by cloning the
last `<c:ser>`.

### 6. Richer text

- Mixed formatting in one text, such as a bold word inside a sentence.
- Hyperlinks (`<a:hlinkClick>` plus a relationship).
- Nested bullet levels; `fillParagraphs` only produces a flat list.
- A warning when text is likely to overflow its shape.

**Proposal:** accept runs (`[{ text, bold, color, link }]`) and paragraphs
with a `level`.

### 7. Speaker notes per slide

Notes can only be filled through `{{tokens}}`.

**Proposal:** `slide.notes.fill(text)` and `slide.notes.fillParagraphs(values)`,
creating the notes slide when the template has none.

## Outside the PPTX code

- **Real data wiring**: only `/pptx/tma` calls the Data API; `/pptx/daa` and
  `/pptx/sample1` still generate random data.
- **JSON POST input for template reports**: these accept only GET query
  parameters. Tables and series supplied by a client need a POST body, as
  `/pptxgenjs/brief` already supports. Review the `100kb` body limit at the
  same time.
- **Checking the output file**: nothing verifies that a generated deck opens
  without PowerPoint's repair prompt. A structural check in tests (every part
  has a content type, every relationship target exists, IDs are unique) would
  catch most corruption from slide duplication and object cloning.
- **PPTX → PDF**: headless LibreOffice conversion could reuse the existing
  generation queue for people who want a PDF of the deck.
- **Language and number formatting**: PDF routes accept `language`, but decks
  have no locale-aware formatting of dates and numbers.
- **More PptxGenJS layouts**: `brief` is the only programmatic layout.

## Recommended order

Start with items 1–3: image replacement, tables that continue onto the next
slide, and conditional slides. They unblock the most real report templates, and
each reuses code that already exists (`cloneObject`, `duplicateSlide`,
`removeSlide`). Extend charts (item 5) when an actual template needs it.
