import { randomUUID } from 'node:crypto';

import express from 'express';
import helmet from 'helmet';

import { loadConfig } from './config.ts';
import { AppError } from './errors.ts';
import { createErrorHandler } from './http/error-handler.ts';
import { discoverRoutes } from './http/file-routes/discover.ts';
import { registerRoutes } from './http/file-routes/register.ts';
import { createObservability } from './http/observability.ts';
import { createGenerationQueues } from './queue/generation-queue.ts';

import type { AppOptions } from './http/types.ts';

const routes = await discoverRoutes(new URL('./routes/', import.meta.url));

/** Assembles HTTP handling around injected services so routes can be tested independently. */
export function createApp(options: AppOptions) {
  const {
    config = loadConfig({}),
    queues = createGenerationQueues(),
    logger = console,
  } = options;
  const observability = createObservability(logger);
  const dependencies = { ...options, config, queues, observability };
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use((req, res, next) => {
    res.locals.requestId = randomUUID();
    res.set('X-Request-Id', res.locals.requestId);
    next();
  });
  app.use(observability.middleware);
  app.use(express.json({ limit: '100kb' }));
  registerRoutes(app, routes, dependencies);
  app.use((req, res, next) =>
    next(new AppError(404, 'NOT_FOUND', 'Endpoint not found')),
  );
  app.use(createErrorHandler(logger));
  return app;
}
