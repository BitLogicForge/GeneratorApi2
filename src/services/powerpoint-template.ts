import { readFile } from 'node:fs/promises';
import JSZip from 'jszip';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import type { TemplatePresentationInput } from '../types.js';

const drawingNamespace =
  'http://schemas.openxmlformats.org/drawingml/2006/main';
const tokenPattern = /\{\{([A-Za-z][A-Za-z0-9_]{0,63})\}\}/g;

/** Mutates only text in slides and speaker notes; preserves all other ZIP parts. */
export class PowerPointTemplateService {
  private readonly templates: Map<string, string>;
  constructor(templates: Record<string, string>) {
    this.templates = new Map(Object.entries(templates));
  }

  async generate(
    template: string,
    input: TemplatePresentationInput,
  ): Promise<Buffer> {
    const path = this.templates.get(template)!;
    const source = await readFile(path);
    const zip = await JSZip.loadAsync(source);
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
    return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  }
}
