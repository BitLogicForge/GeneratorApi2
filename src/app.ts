import express from 'express';
import helmet from 'helmet';
import { randomUUID } from 'node:crypto';
import { loadConfig } from './config.js';
import { createGenerationQueues } from './queue/generation-queue.js';
import { AppError } from './errors.js';
import { createErrorHandler } from './http/error-handler.js';
import type { AppOptions } from './http/types.js';
import { createPdfRoutes } from './routes/pdf.js';
import { createPresentationRoutes } from './routes/presentations.js';

export function createApp(options: AppOptions) {
  const {
    config = loadConfig({}),
    queues = createGenerationQueues(),
    logger = console,
  } = options;
  const dependencies = { ...options, config, queues };
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use((req, res, next) => {
    res.locals.requestId = randomUUID();
    res.set('X-Request-Id', res.locals.requestId);
    next();
  });
  app.use(express.json({ limit: '100kb' }));
  app.get('/health', (req, res) => res.json({ status: 'ok' }));
  app.use(createPdfRoutes(dependencies));
  app.use(createPresentationRoutes(dependencies));
  app.use((req, res, next) =>
    next(new AppError(404, 'NOT_FOUND', 'Endpoint not found')),
  );
  app.use(createErrorHandler(logger));
  return app;
}
