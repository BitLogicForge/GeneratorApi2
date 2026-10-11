import { readFile } from 'node:fs/promises';
import JSZip from 'jszip';
import { findNamedObjects } from '@/pptx/jszip/objects';
import {
  chartNs,
  resolveRelationship,
  relationshipNs,
} from '@/pptx/jszip/package';

export const loadTemplate = async () =>
  JSZip.loadAsync(await readFile('templates/daa.pptx'));
export const chartPath = async (zip: JSZip, path: string) => {
  const { objects } = await findNamedObjects(zip, ['GGO'], [path]);
  return resolveRelationship(
    zip,
    path,
    objects
      .get('GGO')!
      .element.getElementsByTagNameNS(chartNs, 'chart')[0]
      .getAttributeNS(relationshipNs, 'id'),
    'chart',
  );
};
