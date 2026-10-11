import { readFile } from 'node:fs/promises';
import JSZip from 'jszip';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import type { TemplatePresentationInput } from '../schemas.js';
import { AppError } from '../errors.js';

const drawingNamespace =
  'http://schemas.openxmlformats.org/drawingml/2006/main';
const tokenPattern = /\{\{([A-Za-z][A-Za-z0-9_]{0,63})\}\}/g;

/** Mutates only text in slides and speaker notes; preserves all other ZIP parts. */
export class PowerPointTemplateService {
  private readonly templates: Map<string, string>;
  constructor(templates: Record<string, string>) {
    this.templates = new Map(Object.entries(templates));
  }

  /** Replaces paragraph tokens across formatting runs and rejects missing or unused replacement keys. */
  async generate(
    template: string,
    input: TemplatePresentationInput,
  ): Promise<Buffer> {
    // Registry lookup prevents request-controlled paths or arbitrary file reads.
    const path = this.templates.get(template);
    if (!path)
      throw new AppError(
        404,
        'UNKNOWN_TEMPLATE',
        'PowerPoint file template not found',
      );
    const source = await readFile(path);
    if (source.length > 20 * 1024 * 1024)
      throw new AppError(500, 'INVALID_TEMPLATE', 'Template exceeds 20 MB');
    const zip = await JSZip.loadAsync(source);
    if (!zip.file('[Content_Types].xml') || !zip.file('ppt/presentation.xml')) {
      throw new AppError(
        500,
        'INVALID_TEMPLATE',
        'Template must be a valid PPTX presentation',
      );
    }
    const used = new Set<string>();
    const missing = new Set<string>();
    const files = Object.keys(zip.files).filter((name) =>
      /^ppt\/(slides\/slide\d+|notesSlides\/notesSlide\d+)\.xml$/.test(name),
    );
    for (const name of files) {
      const xml = await zip.file(name)!.async('string');
      const document = new DOMParser().parseFromString(xml, 'application/xml');
      let changed = false;
      const paragraphs = document.getElementsByTagNameNS(drawingNamespace, 'p');
      for (let i = 0; i < paragraphs.length; i++) {
        const nodes = Array.from(
          paragraphs.item(i)!.getElementsByTagNameNS(drawingNamespace, 't'),
        );
        const original = nodes.map((node) => node.textContent ?? '');
        const text = original.join('');
        const matches = Array.from(text.matchAll(tokenPattern));
        // Work backwards so earlier character offsets remain valid, including split text runs.
        for (const match of matches.reverse()) {
          const key = match[1];
          if (!Object.hasOwn(input.replacements, key)) {
            missing.add(key);
            continue;
          }
          used.add(key);
          const start = match.index!;
          const end = start + match[0].length;
          let offset = 0;
          for (let n = 0; n < nodes.length; n++) {
            const nodeStart = offset;
            const nodeEnd = offset + original[n].length;
            offset = nodeEnd;
            if (nodeEnd <= start || nodeStart >= end) continue;
            const current = nodes[n].textContent ?? '';
            const from = Math.max(0, start - nodeStart);
            const to = Math.min(original[n].length, end - nodeStart);
            nodes[n].textContent =
              current.slice(0, from) +
              (start >= nodeStart ? input.replacements[key] : '') +
              current.slice(to);
          }
          changed = true;
        }
      }
      if (changed)
        zip.file(name, new XMLSerializer().serializeToString(document));
    }
    if (missing.size)
      throw new AppError(
        400,
        'MISSING_REPLACEMENTS',
        `Missing replacements: ${[...missing].join(', ')}`,
      );
    const unused = Object.keys(input.replacements).filter(
      (key) => !used.has(key),
    );
    if (unused.length)
      throw new AppError(
        400,
        'UNKNOWN_PLACEHOLDERS',
        `Template does not contain: ${unused.join(', ')}`,
      );
    return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  }
}
