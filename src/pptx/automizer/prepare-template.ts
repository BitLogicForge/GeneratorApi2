import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, posix } from 'node:path';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import JSZip from 'jszip';
import { Automizer } from 'pptx-automizer';

import { listSlides } from '@/pptx/jszip/slides/list';

export interface PrepareTemplateOptions {
  /** Explicit 1-based slide numbers to assemble from the source template, e.g. [1, 2, 2, 3, 4]. */
  slides?: number[];
  /** 1-based slide number to duplicate immediately after itself. */
  duplicateSlide?: number;
  /**
   * Expected original slide count before preparation.
   * If the input template already has more slides than this, it is assumed already prepared.
   */
  expectedSourceSlides?: number;
  /** Optional file path where the prepared template presentation will be written. */
  outputPath?: string;
}

async function sanitizeOutputZip(zip: JSZip, slideCount: number): Promise<void> {
  const relsFiles = Object.keys(zip.files).filter(
    (f) => f.startsWith('ppt/slides/_rels/') && f.endsWith('.rels'),
  );

  for (const relFile of relsFiles) {
    const xml = await zip.files[relFile].async('text');
    const doc = new DOMParser().parseFromString(xml, 'text/xml');
    const relationships = Array.from(doc.getElementsByTagName('Relationship'));
    let modified = false;

    for (const rel of relationships) {
      const target = rel.getAttribute('Target') ?? '';
      if (target.startsWith('http')) continue;
      const resolved = posix.normalize(`ppt/slides/${target}`);
      if (!zip.files[resolved]) {
        rel.parentNode?.removeChild(rel);
        modified = true;
      }
    }

    if (modified) {
      zip.file(relFile, new XMLSerializer().serializeToString(doc));
    }
  }

  const chartRelsFiles = Object.keys(zip.files).filter(
    (f) => f.startsWith('ppt/charts/_rels/') && f.endsWith('.rels'),
  );
  for (const relFile of chartRelsFiles) {
    const chartPart = relFile.replace('/_rels/', '/').replace(/\.rels$/, '');
    if (!zip.files[chartPart]) {
      zip.remove(relFile);
    }
  }

  if (zip.files['docProps/app.xml']) {
    const appXml = await zip.files['docProps/app.xml'].async('text');
    const appDoc = new DOMParser().parseFromString(appXml, 'text/xml');
    const slidesEl = appDoc.getElementsByTagName('Slides')[0];
    if (slidesEl) {
      slidesEl.textContent = String(slideCount);
    }
    const headingPairs = appDoc.getElementsByTagName('HeadingPairs')[0];
    if (headingPairs) {
      const variants = Array.from(headingPairs.getElementsByTagName('vt:variant'));
      for (let i = 0; i < variants.length; i++) {
        if (variants[i].textContent?.trim() === 'Slide Titles') {
          const countEl = variants[i + 1]?.getElementsByTagName('vt:i4')[0];
          if (countEl) countEl.textContent = String(slideCount);
          break;
        }
      }
    }
    zip.file('docProps/app.xml', new XMLSerializer().serializeToString(appDoc));
  }
}

/** Prepares a PowerPoint template archive using pptx-automizer, e.g. for slide duplication. */
export async function prepareTemplate(
  source: string | Buffer,
  options: PrepareTemplateOptions = {},
): Promise<Buffer> {
  const sourceBuffer = typeof source === 'string' ? await readFile(source) : source;
  const zip = await JSZip.loadAsync(sourceBuffer);
  const slidePaths = await listSlides(zip);
  const slideCount = slidePaths.length;

  if (options.expectedSourceSlides !== undefined && slideCount > options.expectedSourceSlides) {
    if (options.outputPath) {
      await mkdir(dirname(options.outputPath), { recursive: true });
      await writeFile(options.outputPath, sourceBuffer);
    }
    return sourceBuffer;
  }

  let slideOrder: number[];
  if (options.slides) {
    slideOrder = options.slides;
  } else if (options.duplicateSlide !== undefined) {
    slideOrder = [];
    for (let i = 1; i <= slideCount; i++) {
      slideOrder.push(i);
      if (i === options.duplicateSlide) {
        slideOrder.push(i);
      }
    }
  } else {
    slideOrder = Array.from({ length: slideCount }, (_, i) => i + 1);
  }

  const automizer = new Automizer({
    removeExistingSlides: true,
    cleanup: true,
    verbosity: 0,
  });

  automizer.loadRoot(sourceBuffer).load(sourceBuffer, 'source');

  for (const slideNum of slideOrder) {
    automizer.addSlide('source', slideNum);
  }

  const outputZip = await automizer.getJSZip();
  await sanitizeOutputZip(outputZip, slideOrder.length);

  const outputBuffer = await outputZip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
  });

  if (options.outputPath) {
    await mkdir(dirname(options.outputPath), { recursive: true });
    await writeFile(options.outputPath, outputBuffer);
  }

  return outputBuffer;
}
