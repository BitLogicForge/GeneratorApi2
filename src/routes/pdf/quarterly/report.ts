import { definePdfReport } from '@/reports/pdf';
import { mapPdfRoute } from '@/reports/pdf-route';

import { requestSchema } from './schema.ts';

// External page on WEBAPP_BASE_URL.
const externalRoute = '/reports/quarterly';

export default definePdfReport({
  schema: requestSchema,
  readRequestInput: (req) => ({ query: req.query }),
  prepareInput: ({ query }) => ({
    ...mapPdfRoute(externalRoute, query, {
      year: 'year',
      quarter: 'quarter',
      language: 'language',
    }),
    filename: `quarterly-${query.year}-q${query.quarter}-${query.language}`,
    waitForSelector: '[data-report-ready]',
  }),
  print: { landscape: false },
});
