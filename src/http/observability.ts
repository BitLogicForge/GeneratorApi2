import { LogEvent } from '@/observability/constants';
import { createEndpointMetrics } from '@/observability/endpoint-metrics';

import { ExportFormat, UNMATCHED_ROUTE } from './constants.ts';

import type { RequestHandler } from 'express';

export interface ObservabilityOptions {
  ignoreUnmatched?: boolean;
  excludeRoutes?: readonly string[];
}

/** Aggregates only registered route patterns; never URLs or payloads. */
export function createObservability(
  logger: { info?: (event: unknown) => void },
  options: ObservabilityOptions = {},
) {
  const endpoints = createEndpointMetrics();
  const middleware: RequestHandler = (req, res, next) => {
    const started = performance.now();
    const finishEndpoint = endpoints.start(req);
    let recorded = false;
    const complete = () => {
      if (recorded) return;
      recorded = true;
      const route = typeof req.route?.path === 'string' ? req.route.path : UNMATCHED_ROUTE;
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
      finishEndpoint(event, !res.writableFinished);
      if (
        (options.ignoreUnmatched && route === UNMATCHED_ROUTE) ||
        (options.excludeRoutes && options.excludeRoutes.includes(route))
      ) {
        return;
      }
      logger.info?.(event);
    };
    res.once('finish', complete);
    res.once('close', complete);
    next();
  };
  return {
    middleware,
    endpointSnapshot: () => endpoints.snapshot(),
  };
}
