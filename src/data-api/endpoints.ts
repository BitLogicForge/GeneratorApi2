import { reportIdsSchema } from './report-ids-schema.ts';
import { customerDataSchema } from './customer-data-schema.ts';
import { reportSummarySchema } from './report-summary-schema.ts';
import { reportDataSchema } from './report-data-schema.ts';

/** Define each upstream path and its validated response contract together. */
export const dataApiEndpoints = {
  reportIds: {
    path: (_params: Record<string, never>) => '/reports',
    response: reportIdsSchema,
  },
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
