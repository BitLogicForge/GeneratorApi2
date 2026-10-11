import { z } from 'zod';

import { documentedRoute } from '@/http/openapi/route';

import type { RequestHandler } from 'express';

function createHandler(): RequestHandler {
  return (req, res) => {
    res.json({ status: 'ok' });
  };
}

export default documentedRoute(createHandler, {
  summary: 'Check process health',
  tag: 'Health',
  response: z.object({ status: z.literal('ok') }),
});
