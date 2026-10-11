import type JSZip from 'jszip';
import { DOMParser } from '@xmldom/xmldom';
import { invalidTemplate } from './invalid-template.ts';

export const readXml = async (archive: JSZip, path: string) => {
  const file = archive.file(path);
  if (!file) throw invalidTemplate();
  return new DOMParser().parseFromString(
    await file.async('string'),
    'application/xml',
  );
};
