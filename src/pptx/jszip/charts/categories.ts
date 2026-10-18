import { z } from 'zod';

import { invalidTemplate } from '@/pptx/jszip/package/invalid-template';
import { chartNs } from '@/pptx/jszip/package/namespaces';

import type { Element } from '@xmldom/xmldom';

function toNumericCategory(value: string | number, date1904: boolean): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && z.iso.date().safeParse(value).success) {
    const date = Date.parse(value);
    const epoch = Date.parse(date1904 ? '1904-01-01' : '1899-12-31');
    // Excel's 1900 calendar includes the fictitious 1900-02-29.
    return (
      (date - epoch) / 86400000 +
      (!date1904 && date >= Date.parse('1900-03-01') ? 1 : 0)
    );
  }
  if (
    typeof value === 'string' &&
    value.trim() &&
    Number.isFinite(Number(value))
  ) {
    return Number(value);
  }
  throw invalidTemplate(
    `Numeric chart categories require finite numbers or YYYY-MM-DD dates; received "${value}"`,
  );
}

/** Resolves category cache element, formula, and normalized category labels for a series. */
export function resolveSeriesCategories(
  seriesItem: Element,
  categories: (string | number)[] | undefined,
  rowCount: number,
  date1904: boolean,
) {
  const category = seriesItem.getElementsByTagNameNS(chartNs, 'cat')[0];
  const categoryCache =
    category?.getElementsByTagNameNS(chartNs, 'strCache')[0] ??
    category?.getElementsByTagNameNS(chartNs, 'multiLvlStrCache')[0] ??
    category?.getElementsByTagNameNS(chartNs, 'numCache')[0];
  const categoryFormula = category?.getElementsByTagNameNS(chartNs, 'f')[0];
  if (
    !categoryCache ||
    categoryCache.getElementsByTagNameNS(chartNs, 'lvl').length > 1
  ) {
    throw invalidTemplate();
  }
  const rawValues =
    categories ??
    Array.from(categoryCache.getElementsByTagNameNS(chartNs, 'v')).map(
      (node) => node.textContent ?? '',
    );
  const labels =
    categoryCache.localName === 'numCache'
      ? rawValues.map((value) => toNumericCategory(value, date1904))
      : rawValues.map(String);
  if (labels.length !== rowCount) throw invalidTemplate();
  return { categoryCache, categoryFormula, labels };
}
