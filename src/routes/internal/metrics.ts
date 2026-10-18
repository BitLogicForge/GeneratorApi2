import { CacheControlValue, HttpHeader } from '@/http/constants';

import type { RouteFactory } from '@/http/types';

const metrics: RouteFactory =
  ({ queues, pdf, observability }) =>
  (_req, res) => {
    res.set(HttpHeader.CacheControl, CacheControlValue.NoStore).json({
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

export default metrics;
