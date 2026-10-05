import express from 'express';
import { loadConfig } from './config.js';
import type { AppOptions } from './http/types.js';
import { createPdfRoutes } from './routes/pdf.js';
import { createPresentationRoutes } from './routes/presentations.js';

export function createApp(options: AppOptions) {
  const dependencies = { ...options, config: options.config ?? loadConfig() };
  const app = express();
  app.use(express.json());
  app.get('/health', (req, res) => res.json({ status: 'ok' }));
  app.use(createPdfRoutes(dependencies));
  app.use(createPresentationRoutes(dependencies));
  return app;
}
