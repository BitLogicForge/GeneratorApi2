import { definePdfReport } from '@/reports/pdf';

import { requestSchema } from './schema.ts';

// Fixed external site for this test route.
const externalPage = new URL('https://example.com/');

export default definePdfReport({
  schema: requestSchema,
  readRequestInput: (req) => ({ query: req.query }),
  externalOrigin: externalPage.origin,
  prepareInput: ({ query }) => ({
    route: externalPage.pathname,
    query,
    filename: 'example',
  }),
  print: { landscape: false },
});
