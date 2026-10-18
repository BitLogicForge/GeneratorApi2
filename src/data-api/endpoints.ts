import { compile } from 'path-to-regexp';

import { customerDataSchema } from './customer-data-schema.ts';
import { reportDataSchema } from './report-data-schema.ts';
import { reportIdsSchema } from './report-ids-schema.ts';
import { reportSummarySchema } from './report-summary-schema.ts';

const reportPath = compile('/reports/:id');
const customerPath = compile('/customers/:id');
const reportSummaryPath = compile('/reports/:id/summary');

/** Define each upstream path and its validated response contract together. */
export const dataApiEndpoints = {
  reportIds: {
    path: (_params: Record<string, never>) => '/reports',
    response: reportIdsSchema,
  },
  report: {
    path: (params: { id: string }) => reportPath(params),
    response: reportDataSchema,
  },
  customer: {
    path: (params: { id: string }) => customerPath(params),
    response: customerDataSchema,
  },
  reportSummary: {
    path: (params: { id: string }) => reportSummaryPath(params),
    response: reportSummarySchema,
  },
};
