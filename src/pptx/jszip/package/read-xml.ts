import { DOMParser } from '@xmldom/xmldom';

import { invalidTemplate } from './invalid-template.ts';

import type JSZip from 'jszip';

export const readXml = async (archive: JSZip, path: string) => {
  const file = archive.file(path);
  if (!file) throw invalidTemplate();
  return new DOMParser().parseFromString(
    await file.async('string'),
    'application/xml',
  );
};
