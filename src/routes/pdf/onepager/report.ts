import { formatDateTime } from '@/date-time';
import { definePdfReport } from '@/reports/pdf';
import { filenameSchema } from '@/validation/filename';

import { requestSchema } from './schema.ts';

export default definePdfReport({
  schema: requestSchema,
  readRequestInput: (req) => ({ id: req.params.id, query: req.query }),
  prepareInput: ({ id, query }) => {
    const timestamp = formatDateTime(new Date(), { filenameSafe: true });
    const filename = `onepager-${timestamp}-${id}`;
    return {
      route: '/onepager/:id',
      params: { id },
      query,
      // Preserve the complete ID when adding a timestamp would exceed the filename limit.
      filename: filenameSchema.safeParse(filename).success ? filename : id,
    };
  },
  print: { landscape: true },
});
