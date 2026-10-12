import { definePdfReport } from '@/reports/pdf';
import { mapPdfRoute } from '@/reports/pdf-route';

import { requestSchema } from './schema.ts';

// Fixed external site for this test route.
const externalPage = new URL('https://example.com/');

export default definePdfReport({
  schema: requestSchema,
  readRequestInput: (req) => ({ query: req.query }),
  externalOrigin: externalPage.origin,
  prepareInput: ({ query }) => ({
    ...mapPdfRoute(externalPage.pathname, query, {}),
    filename: 'onet',
  }),
  print: { landscape: false },
});
