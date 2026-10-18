import { z } from 'zod';

export const queueOptionsSchema = z
  .object({
    concurrency: z.number().int().min(1),
    maxPending: z.number().int().min(0),
    waitTimeoutMs: z.number().int().min(1),
  })
  .strict();

export type QueueOptions = z.infer<typeof queueOptionsSchema>;
