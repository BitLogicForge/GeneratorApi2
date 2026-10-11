import { quarterlyPdfQuerySchema } from '@/schemas/quarterly-pdf';

import { createPdfHandler } from '../../handler.ts';
import { createQuarterlyReportPdfInput } from './quarterly-report-pdf.ts';

import type { RouteDependencies } from '@/http/types';

/** Forwards direct GET parameters to the fixed quarterly HTML page. */
export default function createHandler(dependencies: RouteDependencies) {
  return createPdfHandler(dependencies, {
    schema: quarterlyPdfQuerySchema,
    readInput: (req) => req.query,
    prepareInput: createQuarterlyReportPdfInput,
  });
}
