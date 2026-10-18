export const PackagePath = {
  ContentTypes: '[Content_Types].xml',
  Presentation: 'ppt/presentation.xml',
  PresentationRels: 'ppt/_rels/presentation.xml.rels',
  Workbook: 'xl/workbook.xml',
} as const;

export const RelationshipType = {
  Chart: 'chart',
  Package: 'package',
  NotesSlide: 'notesSlide',
  Slide: 'slide',
  Worksheet: 'worksheet',
  Table: 'table',
} as const;

export type RelationshipType =
  (typeof RelationshipType)[keyof typeof RelationshipType];

export const TargetMode = {
  External: 'External',
} as const;

export const DRAWING_FILL_TAGS = [
  'noFill',
  'solidFill',
  'gradFill',
  'blipFill',
  'pattFill',
  'grpFill',
] as const;

export const TABLE_MERGE_ATTRIBUTES = [
  'rowSpan',
  'gridSpan',
  'hMerge',
  'vMerge',
] as const;
