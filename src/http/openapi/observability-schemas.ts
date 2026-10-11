import { z } from 'zod';

import {
  ManagedExternally,
  RendererState,
  TemplateState,
} from '@/observability/constants';

export const readinessSchema = z.object({
  ready: z.boolean(),
  shuttingDown: z.boolean(),
  templates: z.union([z.enum(TemplateState), z.literal(ManagedExternally)]),
  renderer: z.union([z.enum(RendererState), z.literal(ManagedExternally)]),
});
const queue = z.object({
  active: z.number(),
  pending: z.number(),
  concurrency: z.number(),
  maxPending: z.number(),
  accepting: z.boolean(),
});
export const metricsSchema = z.object({
  uptimeSeconds: z.number(),
  memory: z.object({
    rss: z.number(),
    heapTotal: z.number(),
    heapUsed: z.number(),
    external: z.number(),
    arrayBuffers: z.number(),
  }),
  queues: z.object({ pdf: queue, presentations: queue }),
  browser: z
    .object({
      state: z.enum(RendererState),
      launches: z.number(),
      launchFailures: z.number(),
      disconnects: z.number(),
      active: z.number(),
    })
    .nullable(),
  requests: z.array(
    z.object({
      route: z.string(),
      method: z.string(),
      status: z.number(),
      requests: z.number(),
      failures: z.number(),
      outputBytes: z.number(),
      queueWaitMs: z.number(),
      generationMs: z.number(),
    }),
  ),
});
