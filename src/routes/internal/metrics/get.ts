import type { RequestHandler } from 'express';
import type { RouteDependencies } from '@/http/types';

export default function createHandler({
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
