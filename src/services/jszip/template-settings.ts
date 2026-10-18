import { fillCategoryChart } from '@/pptx/jszip/charts';
import { findNamedObjects } from '@/pptx/jszip/objects';
import { deleteObject } from '@/pptx/jszip/objects/delete';
import { moveObject } from '@/pptx/jszip/objects/move';
import { resizeObject } from '@/pptx/jszip/objects/resize';
import { getTargetElement } from '@/pptx/jszip/objects/transform';
import { invalidTemplate } from '@/pptx/jszip/package/invalid-template';
import { chartNs, drawing } from '@/pptx/jszip/package/namespaces';
import { writeXml } from '@/pptx/jszip/package/write-xml';
import { fillTable } from '@/pptx/jszip/tables/fill';
import { fillParagraphs } from '@/pptx/jszip/text/fill-paragraphs';
import { fillTextShape } from '@/pptx/jszip/text/fill-shape';
import { replaceParagraphText } from '@/pptx/jszip/text/replace-paragraph-text';

import type { Document } from '@xmldom/xmldom';
import type JSZip from 'jszip';
import type { CategoryChartOptions } from '@/pptx/jszip/charts/types';
import type { NamedObject } from '@/pptx/jszip/objects';
import type {
  MoveObjectOptions,
  ResizeObjectOptions,
} from '@/pptx/jszip/objects/types';
import type { FillTableOptions } from '@/pptx/jszip/tables/types';

interface TextOptions {
  /** Optional literal token (e.g. `'{{ASOF}}'`) replaced within paragraphs when `.fill(text)` is called. */
  replace?: string;
}

interface TableObjectSetting {
  /** PowerPoint Selection Pane object name. */
  name: string;
  /** Optional slide path or 1-based slide number when the name appears on multiple slides. */
  slide?: string | number;
  /** Default table fill options (`startRow`, `startColumn`, `resizeRows`, `resizeColumns`, `cellColors`). */
  options?: FillTableOptions;
}

interface ChartObjectSetting {
  /** PowerPoint Selection Pane object name. */
  name: string;
  /** Optional slide path or 1-based slide number when the name appears on multiple slides. */
  slide?: string | number;
  /** Default category chart options (`sheetName`, `firstColumn`, `firstRow`, `categories`, `seriesNames`, `colors`). */
  options?: CategoryChartOptions;
}

interface TextObjectSetting {
  /** PowerPoint Selection Pane object name. */
  name: string;
  /** Optional slide path or 1-based slide number when the name appears on multiple slides. */
  slide?: string | number;
  /** Default text shape options (`replace`). */
  options?: TextOptions;
}

export interface TemplateSettings {
  /** PowerPoint tables (`<a:tbl>`) keyed by alias. */
  tables?: Record<string, TableObjectSetting>;
  /** PowerPoint category charts (`<c:chart>`) keyed by alias. */
  charts?: Record<string, ChartObjectSetting>;
  /** PowerPoint text shapes (`<p:sp>`) keyed by alias. */
  texts?: Record<string, TextObjectSetting>;
}

interface ObjectHandleBase {
  /** Resolved PowerPoint slide path and shape XML element. */
  readonly object: NamedObject;
  /** Moves the object on its slide using absolute coordinates (`x`, `y`) and/or relative offsets (`dx`, `dy`) in centimeters (cm). */
  move(options: MoveObjectOptions): void;
  /** Resizes the object on its slide using absolute dimensions (`width`, `height`) and/or relative deltas (`dWidth`, `dHeight`) in centimeters (cm). */
  resize(options: ResizeObjectOptions): void;
  /** Removes the object from its slide. */
  delete(): void;
}

interface TableObjectHandle extends ObjectHandleBase {
  /** Fills table cells using the preconfigured `options` (`startRow`, `startColumn`, `resizeRows`, `resizeColumns`, `cellColors`), merged with optional per-call overrides. */
  fill(data: (string | number)[][], options?: FillTableOptions): void;
}

interface ChartObjectHandle extends ObjectHandleBase {
  /** Updates chart series caches, formulas, and the embedded `.xlsx` workbook using the preconfigured `options` (`sheetName`, `firstColumn`, `firstRow`, `categories`, `seriesNames`, `colors`), merged with optional per-call overrides. */
  fill(data: number[][], options?: CategoryChartOptions): Promise<void>;
}

interface TextObjectHandle extends ObjectHandleBase {
  /** Replaces the configured `options.replace` token if set in `templateSettings`, or replaces the entire shape text while preserving first-run formatting. */
  fill(text: string): void;
  /** Replaces body paragraphs, cloning the last paragraph's style when growing and removing extras when shrinking. */
  fillParagraphs(values: string[]): void;
  /** Replaces literal text occurrences within paragraphs, including matches split across formatted runs. */
  replace(search: string, replacement: string): number;
}

type HandleMap<Group, Handle> =
  Group extends Record<string, unknown>
    ? { readonly [Key in keyof Group]: Handle }
    : Record<never, never>;

/** Mutable PowerPoint archive session with bound object handles grouped by `tables`, `charts`, and `texts`. */
export interface TemplateDeck<Settings extends TemplateSettings> {
  /** Bound table handles for each entry in `templateSettings.tables`. */
  readonly tables: HandleMap<Settings['tables'], TableObjectHandle>;
  /** Bound chart handles for each entry in `templateSettings.charts`. */
  readonly charts: HandleMap<Settings['charts'], ChartObjectHandle>;
  /** Bound text shape handles for each entry in `templateSettings.texts`. */
  readonly texts: HandleMap<Settings['texts'], TextObjectHandle>;
  /** Mutable JSZip archive for this render call. */
  readonly zip: JSZip;
  /** Parsed XML documents for slides containing bound objects, automatically written back on `toBuffer()`. */
  readonly slides: Map<string, Document>;
  /** Serializes modified slide XML documents back into the archive and generates the output `.pptx` buffer. */
  toBuffer(): Promise<Buffer>;
}

function createObjectHandleBase(object: NamedObject): ObjectHandleBase {
  return {
    object,
    move: (options) => {
      moveObject(object, options);
    },
    resize: (options) => {
      resizeObject(object, options);
    },
    delete: () => {
      deleteObject(object);
    },
  };
}

function createTableHandle(
  setting: TableObjectSetting,
  object: NamedObject,
): TableObjectHandle {
  if (!object.element.getElementsByTagNameNS(drawing, 'tbl')[0])
    throw invalidTemplate(`Object "${setting.name}" is not a table`);
  return {
    ...createObjectHandleBase(object),
    fill: (data, options) => {
      fillTable(getTargetElement(object), data, {
        ...setting.options,
        ...options,
      });
    },
  };
}

function createChartHandle(
  zip: JSZip,
  setting: ChartObjectSetting,
  object: NamedObject,
): ChartObjectHandle {
  if (!object.element.getElementsByTagNameNS(chartNs, 'chart')[0])
    throw invalidTemplate(`Object "${setting.name}" is not a chart`);
  return {
    ...createObjectHandleBase(object),
    fill: async (data, options) => {
      getTargetElement(object);
      await fillCategoryChart(zip, object, data, {
        ...setting.options,
        ...options,
      });
    },
  };
}

function createTextHandle(
  setting: TextObjectSetting,
  object: NamedObject,
): TextObjectHandle {
  if (object.element.localName !== 'sp')
    throw invalidTemplate(`Object "${setting.name}" is not a text shape`);
  const token = setting.options?.replace;
  return {
    ...createObjectHandleBase(object),
    fill: (text) => {
      const element = getTargetElement(object);
      if (token !== undefined) {
        replaceParagraphText(element, token, text);
        return;
      }
      fillTextShape(element, text);
    },
    fillParagraphs: (values) => {
      fillParagraphs(getTargetElement(object), values);
    },
    replace: (search, replacement) =>
      replaceParagraphText(getTargetElement(object), search, replacement),
  };
}

/** Validates configured template objects and binds each entry in `tables`, `charts`, and `texts` to its preconfigured fill handle. */
export async function bindTemplateSettings<Settings extends TemplateSettings>(
  zip: JSZip,
  settings: Settings,
): Promise<TemplateDeck<Settings>> {
  const tableEntries = Object.entries(settings.tables ?? {});
  const chartEntries = Object.entries(settings.charts ?? {});
  const textEntries = Object.entries(settings.texts ?? {});
  const names = [
    ...new Set(
      [...tableEntries, ...chartEntries, ...textEntries].map(
        ([, setting]) => setting.name,
      ),
    ),
  ];
  const { slides, objects } =
    names.length > 0
      ? await findNamedObjects(zip, names)
      : { slides: new Map<string, Document>(), objects: undefined };

  const tables: Record<string, TableObjectHandle> = {};
  for (const [key, setting] of tableEntries) {
    tables[key] = createTableHandle(
      setting,
      objects!.get(setting.name, setting.slide),
    );
  }

  const charts: Record<string, ChartObjectHandle> = {};
  for (const [key, setting] of chartEntries) {
    charts[key] = createChartHandle(
      zip,
      setting,
      objects!.get(setting.name, setting.slide),
    );
  }

  const texts: Record<string, TextObjectHandle> = {};
  for (const [key, setting] of textEntries) {
    texts[key] = createTextHandle(
      setting,
      objects!.get(setting.name, setting.slide),
    );
  }

  return {
    tables: tables as HandleMap<Settings['tables'], TableObjectHandle>,
    charts: charts as HandleMap<Settings['charts'], ChartObjectHandle>,
    texts: texts as HandleMap<Settings['texts'], TextObjectHandle>,
    zip,
    slides,
    toBuffer: async () => {
      for (const [path, document] of slides) writeXml(zip, path, document);
      return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
    },
  };
}
