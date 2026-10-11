import { readinessSchema } from '@/http/openapi/observability-schemas';
import { documentedRoute } from '@/http/openapi/route';
import { ManagedExternally } from '@/observability/constants';

import type { RequestHandler } from 'express';
import type { RouteDependencies } from '@/http/types';

function createHandler({
  readiness,
  queues,
}: RouteDependencies): RequestHandler {
  return (req, res) => {
    const state = readiness?.() ?? {
      ready: true,
      shuttingDown: false,
      templates: ManagedExternally,
      renderer: ManagedExternally,
    };
    const ready =
      state.ready &&
      queues.pdf.stats.accepting &&
      queues.presentations.stats.accepting;
    res
      .set('Cache-Control', 'no-store')
      .status(ready ? 200 : 503)
      .json({ ...state, ready });
  };
}

export default documentedRoute(createHandler, {
  summary: 'Check generation readiness',
  tag: 'Internal',
  response: readinessSchema,
  noStore: true,
  responses: {
    503: {
      description: 'Generation services are not ready.',
      schema: readinessSchema,
    },
  },
});
