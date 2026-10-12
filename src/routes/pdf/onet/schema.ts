import { z } from 'zod';

// The fixed external test page accepts no caller parameters.
export const requestSchema = z
  .object({ query: z.object({}).strict() })
  .strict();
