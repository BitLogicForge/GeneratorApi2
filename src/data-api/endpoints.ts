import { customerDataSchema } from './customer-data-schema.js';
import { reportSummarySchema } from './report-summary-schema.js';
import { reportDataSchema } from './report-data-schema.js';

/** Define each upstream path and its validated response contract together. */
export const dataApiEndpoints = {
  report: {
    path: ({ id }: { id: string }) => `/reports/${encodeURIComponent(id)}`,
    response: reportDataSchema,
  },
  customer: {
    path: ({ id }: { id: string }) => `/customers/${encodeURIComponent(id)}`,
    response: customerDataSchema,
  },
  reportSummary: {
    path: ({ id }: { id: string }) =>
      `/reports/${encodeURIComponent(id)}/summary`,
    response: reportSummarySchema,
  },
};
