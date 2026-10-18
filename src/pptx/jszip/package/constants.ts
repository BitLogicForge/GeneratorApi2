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
  SlideLayout: 'slideLayout',
  SlideMaster: 'slideMaster',
  Worksheet: 'worksheet',
  Table: 'table',
} as const;

export type RelationshipType =
  (typeof RelationshipType)[keyof typeof RelationshipType];

/** OpenXML English Metric Units per centimeter (`914,400 / 2.54 = 360,000`). */
export const EMU_PER_CM = 360_000;

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

export const PptxErrorMessage = {
  InvalidTemplateObjects:
    'Presentation template has missing, duplicate, or unsupported objects or data',
  TemplateExceedsMaxSize: 'Template exceeds 20 MB',
  TemplateInvalidPptx: 'Template must be a valid PPTX presentation',
} as const;
