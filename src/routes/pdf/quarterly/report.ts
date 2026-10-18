import { definePdfReport } from '@/reports/pdf';

import { requestSchema } from './schema.ts';

export default definePdfReport({
  schema: requestSchema,
  readRequestInput: (req) => ({ query: req.query }),
  prepareInput: ({ query }) => ({
    route: '/reports/quarterly',
    query,
    filename: `quarterly-${query.year}-q${query.quarter}-${query.language}`,
    waitForSelector: '[data-report-ready]',
  }),
  print: { landscape: false },
});
