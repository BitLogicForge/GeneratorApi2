import { reportDataSchema } from './report-data-schema.js';

/** Define each upstream path and its validated response contract together. */
export const dataApiEndpoints = {
  report: {
    path: ({ id }: { id: string }) => `/reports/${encodeURIComponent(id)}`,
    response: reportDataSchema,
  },
};
