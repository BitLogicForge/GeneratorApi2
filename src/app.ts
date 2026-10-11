import express from 'express';
import helmet from 'helmet';
import { randomUUID } from 'node:crypto';
import { loadConfig } from './config.js';
import { createGenerationQueues } from './queue/generation-queue.js';
import { AppError } from './errors.js';
import { createErrorHandler } from './http/error-handler.js';
import type { AppOptions } from './http/types.js';
import { createHealthRoute } from './routes/health.js';
import { createDocumentPdfRoute } from './routes/document-pdf.js';
import { createExportPdfRoute } from './routes/export-pdf.js';
import { createDemoReportRoute } from './routes/demo-report.js';
import { createGeneratedPresentationRoute } from './routes/generated-presentation.js';
import { createTemplatePresentationRoute } from './routes/template-presentation.js';

/** Assembles HTTP handling around injected services so routes can be tested independently. */
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
  app.use(createHealthRoute());
  app.use(createDocumentPdfRoute(dependencies));
  app.use(createExportPdfRoute(dependencies));
  app.use(createDemoReportRoute(dependencies));
  app.use(createGeneratedPresentationRoute(dependencies));
  app.use(createTemplatePresentationRoute(dependencies));
  app.use((req, res, next) =>
    next(new AppError(404, 'NOT_FOUND', 'Endpoint not found')),
  );
  app.use(createErrorHandler(logger));
  return app;
}
