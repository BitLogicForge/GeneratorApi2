import express from 'express';
import helmet from 'helmet';
import { randomUUID } from 'node:crypto';
import { loadConfig } from './config.ts';
import { createGenerationQueues } from './queue/generation-queue.ts';
import { AppError } from './errors.ts';
import { createErrorHandler } from './http/error-handler.ts';
import type { AppOptions } from './http/types.ts';
import { createHealthRoute } from './routes/health.ts';
import { createDocumentPdfRoute } from './routes/document-pdf.ts';
import { createExportPdfRoute } from './routes/export-pdf.ts';
import { createDemoReportRoute } from './routes/demo-report.ts';
import { createGeneratedPresentationRoute } from './routes/generated-presentation.ts';
import { createTemplatePresentationRoute } from './routes/template-presentation.ts';

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
