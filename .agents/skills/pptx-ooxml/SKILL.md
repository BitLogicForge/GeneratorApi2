---
name: pptx-ooxml
description: Edit and generate OpenXML PowerPoint (.pptx) and embedded Excel (.xlsx) packages using JSZip and DOM XML while preserving native editability and styling. Use when working on slides, shapes, text runs, placeholders, tables, charts, embedded workbooks, or package relationships.
---

# OpenXML PowerPoint & Workbook Manipulation Guide

Read the repository's [AGENTS.md](../../../AGENTS.md) before making changes.
Always load source templates into a fresh in-memory archive per operation and
write to a new output buffer; never mutate source template files on disk.

## Synchronize Linked Package Parts

- **Charts & Embedded Workbooks**: Never update chart XML in isolation. Keep
  series value caches (`<c:numCache>`), category caches (`<c:strCache>`,
  `<c:multiLvlStrCache>`, or `<c:numCache>`), range formulas (`<c:f>`), embedded
  `.xlsx` worksheet cells (`<c>`), worksheet `<dimension>`, and Excel table
  definitions (`<table ref="...">` and `<tableColumn>`) synchronized.
- **Excel Date Systems & Types**: Inspect `<workbookPr date1904="...">` before
  converting ISO dates to Excel serial numbers (accounting for the 1900 leap-year
  offset when `date1904` is false). Write numeric values without a string type
  attribute and string values as `<c t="inlineStr"><is><t>...</t></is></c>`,
  adding `xml:space="preserve"` when leading, trailing, or consecutive spaces
  exist.
- **Slides & Relationships**: Resolve targets through `.rels` files rather than
  hardcoding part paths. When duplicating slides, clone mutable dependent parts
  (charts, embedded packages, speaker notes), register new overrides in
  `[Content_Types].xml`, and allocate collision-free `rId` and `<p:sldId>`
  identifiers. When removing slides, keep at least one slide and clean up
  `<p:sldId>` and custom-show/section references.

## Preserve Native Formatting and Schema Ordering

- **Text & Placeholders**: Handle tokens or search strings split across multiple
  formatted `<a:r>` runs by replacing character ranges in reverse order while
  preserving the first run's `<a:rPr>` styling.
- **Tables**: Reject row/column resizing on tables with merged cells (`rowSpan`,
  `gridSpan`, `hMerge`, `vMerge`). When cloning rows or columns, assign fresh
  Office `rowId`/`colId` values and update the parent `<p:xfrm><a:ext>` frame
  dimensions (`cx`/`cy`) proportionally.
- **Strict OpenXML Child Order**: Insert new DrawingML/ChartML elements (such as
  `<a:solidFill>`, `<c:spPr>`, `<a:rPr>`, or `<c:pt>`) before schema-mandated
  trailing siblings (e.g. `<c:extLst>`, `<a:ln>`, or `<a:endParaRPr>`) so
  PowerPoint does not report file corruption.

## Verify Proportionally

Keep each operation in a small, single-responsibility module. Run the static
checks in `AGENTS.md` (`typecheck`, `lint:code`, `knip`, and Prettier on changed
files). Do not run tests or generate `.pptx` artifacts unless explicitly asked.
