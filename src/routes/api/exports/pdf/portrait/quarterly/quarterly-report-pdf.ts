import { pdfSchema } from '../../schema.ts';

import type { QuarterlyPdfQuery } from './schema.ts';

/** Prints a fixed webapp endpoint with validated GET query values. */
export function createQuarterlyReportPdfInput(query: QuarterlyPdfQuery) {
  return pdfSchema.parse({
    route: '/reports/quarterly',
    query,
    filename: `quarterly-${query.year}-q${query.quarter}-${query.language}`,
    waitForSelector: '[data-report-ready]',
    landscape: false,
  });
}
