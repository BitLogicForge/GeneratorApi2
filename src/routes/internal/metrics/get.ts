import { metricsSchema } from '@/http/openapi/observability-schemas';
import { documentedRoute } from '@/http/openapi/route';

import type { RequestHandler } from 'express';
import type { RouteDependencies } from '@/http/types';

function createHandler({
  queues,
  pdf,
  observability,
}: RouteDependencies): RequestHandler {
  return (req, res) => {
    res.set('Cache-Control', 'no-store').json({
      uptimeSeconds: process.uptime(),
      memory: process.memoryUsage(),
      queues: {
        pdf: queues.pdf.stats,
        presentations: queues.presentations.stats,
      },
      browser: pdf.stats ?? null,
      requests: observability.snapshot(),
    });
  };
}

export default documentedRoute(createHandler, {
  summary: 'Inspect generation metrics',
  tag: 'Internal',
  response: metricsSchema,
  noStore: true,
});
