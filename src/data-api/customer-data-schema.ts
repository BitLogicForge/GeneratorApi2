import { z } from 'zod';

import { documentTextSchema } from '@/validation/schema';

export const customerDataSchema = z.object({
  id: documentTextSchema,
  name: documentTextSchema,
  industry: documentTextSchema,
  contactEmail: z.email(),
});
