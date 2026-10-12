import { definePdfReport } from '@/reports/pdf';
import { mapPdfRoute } from '@/reports/pdf-route';
import {
  pdfRoutePatternSchema,
  resolvePdfRoute,
} from '@/services/pdf/contracts';

import { requestSchema } from './schema.ts';

// External page on WEBAPP_BASE_URL; {id} may appear in the path or query.
const externalRoute = pdfRoutePatternSchema.parse('/onepager/{id}');

const date = new Date().toISOString().split('T')[0];
const time = new Date()
  .toISOString()
  .split('T')[1]
  .split(':')
  .slice(0, 2)
  .join(':');

export default definePdfReport({
  schema: requestSchema,
  readRequestInput: (req) => ({ id: req.params.id, query: req.query }),
  prepareInput: ({ id, query }) => ({
    ...mapPdfRoute(resolvePdfRoute(externalRoute, id), query, {
      START: 'START',
      END: 'END',
      BENCHMARK: 'BENCHMARK',
    }),
    filename: `onepager-${date}-${time}-${id}`,
  }),
  print: { landscape: true },
});
