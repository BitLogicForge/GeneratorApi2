import { drawing } from '@/pptx/jszip/package/namespaces';
import { readXml } from '@/pptx/jszip/package/read-xml';
import { writeXml } from '@/pptx/jszip/package/write-xml';

import { findTextParts } from './placeholders/find-text-parts.ts';
import { replaceParagraphTokens } from './placeholders/replace-paragraph-tokens.ts';
import { validateReplacementUsage } from './placeholders/validate-replacement-usage.ts';

import type JSZip from 'jszip';
import type { ReplacementUsage } from './placeholders/types.ts';

/** Replaces slide and note tokens across text runs while preserving formatting. */
export async function replacePlaceholders(
  zip: JSZip,
  replacements: Record<string, string>,
): Promise<void> {
  const usage: ReplacementUsage = { used: new Set(), missing: new Set() };
  for (const name of await findTextParts(zip)) {
    const document = await readXml(zip, name);
    let changed = false;
    const paragraphs = document.getElementsByTagNameNS(drawing, 'p');
    for (let i = 0; i < paragraphs.length; i++) {
      if (replaceParagraphTokens(paragraphs.item(i)!, replacements, usage)) changed = true;
    }
    if (changed) writeXml(zip, name, document);
  }
  validateReplacementUsage(replacements, usage);
}
