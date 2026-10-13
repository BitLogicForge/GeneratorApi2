import { formatDateTime } from '@/date-time';
import { definePdfReport } from '@/reports/pdf';
import { mapPdfRoute } from '@/reports/pdf-route';
import {
  pdfRoutePatternSchema,
  resolvePdfRoute,
} from '@/services/pdf/contracts';
import { filenameSchema } from '@/validation/filename';

import { requestSchema } from './schema.ts';

// External page on WEBAPP_BASE_URL; {id} may appear in the path or query.
const externalRoute = pdfRoutePatternSchema.parse('/onepager/{id}');

export default definePdfReport({
  schema: requestSchema,
  readRequestInput: (req) => ({ id: req.params.id, query: req.query }),
  prepareInput: ({ id, query }) => {
    const timestamp = formatDateTime(new Date(), { filenameSafe: true });
    const filename = `onepager-${timestamp}-${id}`;
    return {
      ...mapPdfRoute(resolvePdfRoute(externalRoute, id), query, {
        START: 'START',
        END: 'END',
        BENCHMARK: 'BENCHMARK',
      }),
      // Preserve the complete ID when adding a timestamp would exceed the filename limit.
      filename: filenameSchema.safeParse(filename).success ? filename : id,
    };
  },
  print: { landscape: true },
});
