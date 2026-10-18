import { LogEvent } from '@/observability/constants';

import { ExportFormat, UNMATCHED_ROUTE } from './constants.ts';

import type { RequestHandler } from 'express';

/** Aggregates only registered route patterns; never URLs or payloads. */
export function createObservability(logger: {
  info?: (event: unknown) => void;
}) {
  const totals = new Map<
    string,
    {
      requests: number;
      failures: number;
      outputBytes: number;
      queueWaitMs: number;
      generationMs: number;
    }
  >();
  const middleware: RequestHandler = (req, res, next) => {
    const started = performance.now();
    let recorded = false;
    const complete = () => {
      if (recorded) return;
      recorded = true;
      const route =
        typeof req.route?.path === 'string' ? req.route.path : UNMATCHED_ROUTE;
      const format = route.includes(ExportFormat.Pptx)
        ? ExportFormat.Pptx
        : route.includes(ExportFormat.Pdf)
          ? ExportFormat.Pdf
          : null;
      const status = res.writableFinished ? res.statusCode : 499;
      const event = {
        event: LogEvent.RequestCompleted,
        requestId: res.locals.requestId,
        method: req.method,
        route,
        format,
        status,
        durationMs: performance.now() - started,
        queueWaitMs: res.locals.queueWaitMs ?? 0,
        generationMs: res.locals.generationMs ?? 0,
        outputBytes: res.writableFinished ? (res.locals.outputBytes ?? 0) : 0,
      };
      const key = JSON.stringify([route, req.method, status]);
      const total = totals.get(key) ?? {
        requests: 0,
        failures: 0,
        outputBytes: 0,
        queueWaitMs: 0,
        generationMs: 0,
      };
      total.requests++;
      if (status >= 400) total.failures++;
      total.outputBytes += event.outputBytes;
      total.queueWaitMs += event.queueWaitMs;
      total.generationMs += event.generationMs;
      totals.set(key, total);
      logger.info?.(event);
    };
    res.once('finish', complete);
    res.once('close', complete);
    next();
  };
  return {
    middleware,
    snapshot: () =>
      Array.from(totals, ([key, total]) => {
        const [route, method, status] = JSON.parse(key);
        return { route, method, status, ...total };
      }),
  };
}
