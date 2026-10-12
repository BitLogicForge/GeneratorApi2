import { definePdfReport } from '@/reports/pdf';
import { mapPdfRoute } from '@/reports/pdf-route';
import {
  pdfRoutePatternSchema,
  resolvePdfRoute,
} from '@/services/pdf/contracts';

import { requestSchema } from './schema.ts';

// External page on WEBAPP_BASE_URL; {id} may appear in the path or query.
const externalRoute = pdfRoutePatternSchema.parse('/factsheet/{id}');
const defaultLanguage = 'en';

export default definePdfReport({
  schema: requestSchema,
  readRequestInput: (req) => ({ id: req.params.id, query: req.query }),
  prepareInput: ({ id, query }) => ({
    ...mapPdfRoute(
      resolvePdfRoute(externalRoute, id),
      query,
      { language: 'language', year: 'year' },
      { language: defaultLanguage },
    ),
    filename: id,
  }),
  print: { landscape: false },
});
