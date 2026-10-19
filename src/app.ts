import { randomUUID } from 'node:crypto';
import express from 'express';
import helmet from 'helmet';

import { loadConfig } from './config.ts';
import { ErrorCode } from './constants.ts';
import { AppError } from './errors.ts';
import { HttpErrorMessage, HttpHeader } from './http/constants.ts';
import { createErrorHandler } from './http/error-handler.ts';
import { createObservability } from './http/observability.ts';
import { createGenerationQueues } from './queue/generation-queue.ts';
import { createRouter } from './routes/router.ts';

import type { AppOptions } from './http/types.ts';

/** Assembles HTTP handling around injected services so routes can be tested independently. */
export function createApp(options: AppOptions, routerFactory: typeof createRouter = createRouter) {
  const {
    config = options.reports?.config ?? loadConfig({}),
    queues = createGenerationQueues(config),
    logger = console,
  } = options;
  const observability = createObservability(logger, {
    ignoreUnmatched: config.logIgnoreUnmatched,
    excludeRoutes: config.logExcludeRoutes,
  });
  const dependencies = { ...options, config, queues, observability };
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use((req, res, next) => {
    res.locals.requestId = randomUUID();
    res.set(HttpHeader.RequestId, res.locals.requestId);
    next();
  });
  app.use(observability.middleware);
  app.use(express.json({ limit: '100kb' }));
  app.use(routerFactory(dependencies));
  app.use((req, res, next) =>
    next(new AppError(404, ErrorCode.NotFound, HttpErrorMessage.EndpointNotFound)),
  );
  app.use(createErrorHandler(logger));
  return app;
}
