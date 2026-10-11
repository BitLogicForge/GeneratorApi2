import { z } from 'zod';

export const customerDataSchema = z.object({
  id: z.string(),
  name: z.string(),
  industry: z.string(),
  contactEmail: z.email(),
});
