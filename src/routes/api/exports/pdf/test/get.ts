import { definePdfReport } from '@/reports/pdf';

import { readRequestInput, requestSchema } from './schema.ts';

export default definePdfReport({
  schema: requestSchema,
  readRequestInput,
  prepareInput: (input) => input,
});
