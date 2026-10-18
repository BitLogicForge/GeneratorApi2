import { fillCategoryChart } from '@/pptx/jszip/charts';
import { findNamedObjects } from '@/pptx/jszip/objects';
import { cloneObject } from '@/pptx/jszip/objects/clone';
import { cloneChartParts } from '@/pptx/jszip/objects/clone-chart-parts';
import { deleteObject } from '@/pptx/jszip/objects/delete';
import { moveObject } from '@/pptx/jszip/objects/move';
import { resolvePlaceholderBounds } from '@/pptx/jszip/objects/placeholder-bounds';
import { resizeObject } from '@/pptx/jszip/objects/resize';
import { getTargetElement } from '@/pptx/jszip/objects/transform';
import { invalidTemplate } from '@/pptx/jszip/package/invalid-template';
import { chartNs, drawing, presentationNs } from '@/pptx/jszip/package/namespaces';
import { readXml } from '@/pptx/jszip/package/read-xml';
import { writeXml } from '@/pptx/jszip/package/write-xml';
import { duplicateSlides } from '@/pptx/jszip/slides/duplicate';
import { listSlides } from '@/pptx/jszip/slides/list';
import { fillTable } from '@/pptx/jszip/tables/fill';
import { fillParagraphs } from '@/pptx/jszip/text/fill-paragraphs';
import { fillTextShape } from '@/pptx/jszip/text/fill-shape';
import { replaceParagraphText } from '@/pptx/jszip/text/replace-paragraph-text';

import type { Document, Element } from '@xmldom/xmldom';
import type JSZip from 'jszip';
import type { CategoryChartOptions } from '@/pptx/jszip/charts/types';
import type { NamedObject } from '@/pptx/jszip/objects';
import type { MoveObjectOptions, ResizeObjectOptions } from '@/pptx/jszip/objects/types';
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

interface ImageObjectSetting {
  /** PowerPoint Selection Pane object name. */
  name: string;
  /** Optional slide path or 1-based slide number when the name appears on multiple slides. */
  slide?: string | number;
}

export interface TemplateSettings {
  /** PowerPoint tables (`<a:tbl>`) keyed by alias. */
  tables?: Record<string, TableObjectSetting>;
  /** PowerPoint category charts (`<c:chart>`) keyed by alias. */
  charts?: Record<string, ChartObjectSetting>;
  /** PowerPoint text shapes (`<p:sp>`) keyed by alias. */
  texts?: Record<string, TextObjectSetting>;
  /** PowerPoint images (`<p:pic>`) keyed by alias. */
  images?: Record<string, ImageObjectSetting>;
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
  /** Clones this table on the slide and returns a new handle. */
  clone(): TableObjectHandle;
}

interface ChartObjectHandle extends ObjectHandleBase {
  /** Updates chart series caches, formulas, and the embedded `.xlsx` workbook using the preconfigured `options` (`sheetName`, `firstColumn`, `firstRow`, `categories`, `seriesNames`, `colors`), merged with optional per-call overrides. */
  fill(data: number[][], options?: CategoryChartOptions): Promise<void>;
  /** Clones this chart on the slide (with independent package parts) and returns a new handle. */
  clone(): ChartObjectHandle;
}

interface TextObjectHandle extends ObjectHandleBase {
  /** Replaces the configured `options.replace` token if set in `templateSettings`, or replaces the entire shape text while preserving first-run formatting. */
  fill(text: string): void;
  /** Replaces body paragraphs, cloning the last paragraph's style when growing and removing extras when shrinking. */
  fillParagraphs(values: string[]): void;
  /** Replaces literal text occurrences within paragraphs, including matches split across formatted runs. */
  replace(search: string, replacement: string): number;
  /** Clones this text shape on the slide and returns a new handle. */
  clone(): TextObjectHandle;
}

interface ImageObjectHandle extends ObjectHandleBase {
  /** Clones this image on the slide and returns a new handle. */
  clone(): ImageObjectHandle;
}

type HandleMap<Group, Handle> =
  Group extends Record<string, unknown>
    ? { readonly [Key in keyof Group]: Handle }
    : Record<never, never>;

/** Bound object handles on a specific slide grouped by `tables`, `charts`, `texts`, and `images`. */
export interface SlideHandle<Settings extends TemplateSettings> {
  /** 1-based presentation slide number. */
  readonly slide: number;
  /** Slide part path in the package (e.g. `ppt/slides/slide2.xml`). */
  readonly path: string;
  /** Bound table handles on this slide for entries configured in `templateSettings.tables`. */
  readonly tables: HandleMap<Settings['tables'], TableObjectHandle>;
  /** Bound chart handles on this slide for entries configured in `templateSettings.charts`. */
  readonly charts: HandleMap<Settings['charts'], ChartObjectHandle>;
  /** Bound text shape handles on this slide for entries configured in `templateSettings.texts`. */
  readonly texts: HandleMap<Settings['texts'], TextObjectHandle>;
  /** Bound image handles on this slide for entries configured in `templateSettings.images`. */
  readonly images: HandleMap<Settings['images'], ImageObjectHandle>;
}

/** Mutable PowerPoint archive session with bound object handles grouped by `tables`, `charts`, `texts`, and `images`. */
export interface TemplateDeck<Settings extends TemplateSettings> {
  /** Bound table handles for each entry in `templateSettings.tables`. */
  readonly tables: HandleMap<Settings['tables'], TableObjectHandle>;
  /** Bound chart handles for each entry in `templateSettings.charts`. */
  readonly charts: HandleMap<Settings['charts'], ChartObjectHandle>;
  /** Bound text shape handles for each entry in `templateSettings.texts`. */
  readonly texts: HandleMap<Settings['texts'], TextObjectHandle>;
  /** Bound image handles for each entry in `templateSettings.images`. */
  readonly images: HandleMap<Settings['images'], ImageObjectHandle>;
  /** Mutable JSZip archive for this render call. */
  readonly zip: JSZip;
  /** Parsed XML documents for slides containing bound objects, automatically written back on `toBuffer()`. */
  readonly slides: Map<string, Document>;
  /** Serializes modified slide XML documents back into the archive and generates the output `.pptx` buffer. */
  toBuffer(): Promise<Buffer>;
  /** Obtains a bound handle for an existing slide by 1-based slide number or slide path. */
  getSlide(slide: number | string): Promise<SlideHandle<Settings>>;
  /** Duplicates a slide sequentially and returns bound handles for all created duplicate slides. */
  duplicateSlide(sourceSlide: number | string, count?: number): Promise<SlideHandle<Settings>[]>;
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

function createTableHandle(setting: TableObjectSetting, object: NamedObject): TableObjectHandle {
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
    clone: () => {
      const clonedObject = cloneObject(object);
      return createTableHandle(setting, clonedObject);
    },
  };
}

function createChartHandle(
  zip: JSZip,
  setting: ChartObjectSetting,
  object: NamedObject,
  pendingTasks: Promise<void>[],
  readyPromise?: Promise<void>,
): ChartObjectHandle {
  if (!object.element.getElementsByTagNameNS(chartNs, 'chart')[0])
    throw invalidTemplate(`Object "${setting.name}" is not a chart`);
  return {
    ...createObjectHandleBase(object),
    fill: async (data, options) => {
      getTargetElement(object);
      if (readyPromise) await readyPromise;
      await fillCategoryChart(zip, object, data, {
        ...setting.options,
        ...options,
      });
    },
    clone: () => {
      const clonedObject = cloneObject(object);
      const copyTask = cloneChartParts(zip, clonedObject.path, clonedObject.element);
      pendingTasks.push(copyTask);
      return createChartHandle(zip, setting, clonedObject, pendingTasks, copyTask);
    },
  };
}

function createTextHandle(setting: TextObjectSetting, object: NamedObject): TextObjectHandle {
  if (object.element.localName !== 'sp')
    throw invalidTemplate(`Object "${setting.name}" is not a text shape`);
  const token = setting.options?.replace;
  return {
    ...createObjectHandleBase(object),
    fill: (text) => {
      const element = getTargetElement(object);
      if (token !== undefined) {
        const count = replaceParagraphText(element, token, text);
        if (count > 0) return;
      }
      fillTextShape(element, text);
    },
    fillParagraphs: (values) => {
      fillParagraphs(getTargetElement(object), values);
    },
    replace: (search, replacement) =>
      replaceParagraphText(getTargetElement(object), search, replacement),
    clone: () => {
      const clonedObject = cloneObject(object);
      return createTextHandle(setting, clonedObject);
    },
  };
}

function createImageHandle(setting: ImageObjectSetting, object: NamedObject): ImageObjectHandle {
  if (object.element.localName !== 'pic')
    throw invalidTemplate(`Object "${setting.name}" is not an image`);
  return {
    ...createObjectHandleBase(object),
    clone: () => {
      const clonedObject = cloneObject(object);
      return createImageHandle(setting, clonedObject);
    },
  };
}

async function findSlideObjects(
  zip: JSZip,
  path: string,
  doc: Document,
): Promise<Map<string, NamedObject>> {
  const objects = new Map<string, NamedObject>();
  for (const properties of Array.from(doc.getElementsByTagNameNS(presentationNs, 'cNvPr'))) {
    const name = properties.getAttribute('name');
    if (!name) continue;
    const element = properties.parentNode?.parentNode as Element | undefined;
    if (!element || !['graphicFrame', 'sp', 'pic'].includes(element.localName ?? '')) continue;
    const placeholderBounds = await resolvePlaceholderBounds(zip, path, element);
    objects.set(name, {
      path,
      element,
      ...(placeholderBounds ? { placeholderBounds } : {}),
    });
  }
  return objects;
}

function createSlideGroupHandles<Setting extends { name: string }, Handle>(
  settingsGroup: Record<string, Setting> | undefined,
  objects: Map<string, NamedObject>,
  createHandle: (setting: Setting, object: NamedObject) => Handle,
  slideNumber: number,
  slidePath: string,
): Record<string, Handle> {
  const handles: Record<string, Handle> = {};
  for (const [key, setting] of Object.entries(settingsGroup ?? {})) {
    const object = objects.get(setting.name);
    if (object) {
      handles[key] = createHandle(setting, object);
    }
  }
  return new Proxy(handles, {
    get(target, prop, receiver) {
      if (typeof prop === 'string' && !(prop in target)) {
        const configured = settingsGroup?.[prop];
        if (configured) {
          throw invalidTemplate(
            `Object "${configured.name}" (alias "${prop}") not found on slide ${slideNumber} (${slidePath})`,
          );
        }
      }
      return Reflect.get(target, prop, receiver);
    },
  });
}

async function bindSlideHandle<Settings extends TemplateSettings>(
  zip: JSZip,
  settings: Settings,
  slide: number | string,
  slides: Map<string, Document>,
  pendingTasks: Promise<void>[],
): Promise<SlideHandle<Settings>> {
  const activeSlides = await listSlides(zip);
  let resolvedPath: string;
  let slideNumber: number;

  if (typeof slide === 'number') {
    if (!Number.isInteger(slide) || slide < 1 || slide > activeSlides.length) {
      throw invalidTemplate(
        `Slide number out of bounds: ${slide} (presentation has ${activeSlides.length} slides)`,
      );
    }
    slideNumber = slide;
    resolvedPath = activeSlides[slide - 1]!;
  } else {
    resolvedPath = slide;
    const index = activeSlides.indexOf(resolvedPath);
    if (index === -1) {
      throw invalidTemplate(`Slide is not part of the presentation: ${slide}`);
    }
    slideNumber = index + 1;
  }

  let slideDoc = slides.get(resolvedPath);
  if (!slideDoc) {
    slideDoc = await readXml(zip, resolvedPath);
    slides.set(resolvedPath, slideDoc);
  }

  const objectsOnSlide = await findSlideObjects(zip, resolvedPath, slideDoc);

  const tables = createSlideGroupHandles(
    settings.tables,
    objectsOnSlide,
    (setting, obj) => createTableHandle(setting, obj),
    slideNumber,
    resolvedPath,
  );

  const charts = createSlideGroupHandles(
    settings.charts,
    objectsOnSlide,
    (setting, obj) => createChartHandle(zip, setting, obj, pendingTasks),
    slideNumber,
    resolvedPath,
  );

  const texts = createSlideGroupHandles(
    settings.texts,
    objectsOnSlide,
    (setting, obj) => createTextHandle(setting, obj),
    slideNumber,
    resolvedPath,
  );

  const images = createSlideGroupHandles(
    settings.images,
    objectsOnSlide,
    (setting, obj) => createImageHandle(setting, obj),
    slideNumber,
    resolvedPath,
  );

  return {
    slide: slideNumber,
    path: resolvedPath,
    tables: tables as HandleMap<Settings['tables'], TableObjectHandle>,
    charts: charts as HandleMap<Settings['charts'], ChartObjectHandle>,
    texts: texts as HandleMap<Settings['texts'], TextObjectHandle>,
    images: images as HandleMap<Settings['images'], ImageObjectHandle>,
  };
}

/** Validates configured template objects and binds each entry in `tables`, `charts`, `texts`, and `images` to its preconfigured handle. */
export async function bindTemplateSettings<Settings extends TemplateSettings>(
  zip: JSZip,
  settings: Settings,
): Promise<TemplateDeck<Settings>> {
  const tableEntries = Object.entries(settings.tables ?? {});
  const chartEntries = Object.entries(settings.charts ?? {});
  const textEntries = Object.entries(settings.texts ?? {});
  const imageEntries = Object.entries(settings.images ?? {});
  const names = [
    ...new Set(
      [...tableEntries, ...chartEntries, ...textEntries, ...imageEntries].map(
        ([, setting]) => setting.name,
      ),
    ),
  ];
  const { slides, objects } =
    names.length > 0
      ? await findNamedObjects(zip, names)
      : { slides: new Map<string, Document>(), objects: undefined };

  const pendingTasks: Promise<void>[] = [];

  const tables: Record<string, TableObjectHandle> = {};
  for (const [key, setting] of tableEntries) {
    tables[key] = createTableHandle(setting, objects!.get(setting.name, setting.slide));
  }

  const charts: Record<string, ChartObjectHandle> = {};
  for (const [key, setting] of chartEntries) {
    charts[key] = createChartHandle(
      zip,
      setting,
      objects!.get(setting.name, setting.slide),
      pendingTasks,
    );
  }

  const texts: Record<string, TextObjectHandle> = {};
  for (const [key, setting] of textEntries) {
    texts[key] = createTextHandle(setting, objects!.get(setting.name, setting.slide));
  }

  const images: Record<string, ImageObjectHandle> = {};
  for (const [key, setting] of imageEntries) {
    images[key] = createImageHandle(setting, objects!.get(setting.name, setting.slide));
  }

  return {
    tables: tables as HandleMap<Settings['tables'], TableObjectHandle>,
    charts: charts as HandleMap<Settings['charts'], ChartObjectHandle>,
    texts: texts as HandleMap<Settings['texts'], TextObjectHandle>,
    images: images as HandleMap<Settings['images'], ImageObjectHandle>,
    zip,
    slides,
    toBuffer: async () => {
      await Promise.all(pendingTasks);
      for (const [path, document] of slides) writeXml(zip, path, document);
      return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
    },
    getSlide: (slide: number | string) =>
      bindSlideHandle(zip, settings, slide, slides, pendingTasks),
    duplicateSlide: async (sourceSlide: number | string, count: number = 1) => {
      if (count <= 0) return [];
      const activeSlides = await listSlides(zip);
      const sourcePath =
        typeof sourceSlide === 'number' ? activeSlides[sourceSlide - 1] : sourceSlide;
      if (sourcePath && slides.has(sourcePath)) {
        writeXml(zip, sourcePath, slides.get(sourcePath)!);
      }
      const createdPaths = await duplicateSlides(zip, sourceSlide, count);
      const result: SlideHandle<Settings>[] = [];
      for (const path of createdPaths) {
        result.push(await bindSlideHandle(zip, settings, path, slides, pendingTasks));
      }
      return result;
    },
  };
}
