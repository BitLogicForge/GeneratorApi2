import { definePdfReport } from '@/reports/pdf';

import { requestSchema } from './schema.ts';

export default definePdfReport({
  schema: requestSchema,
  readRequestInput: (req) => ({ id: req.params.id, query: req.query }),
  prepareInput: ({ id, query }) => ({
    route: '/factsheet/:id',
    params: { id },
    query,
    filename: id,
  }),
  print: { landscape: false },
});
