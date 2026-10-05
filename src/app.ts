import express, { type ErrorRequestHandler } from 'express';
import type { PdfInput, PresentationInput } from './schemas.js';
interface Services {
  pdf: { generate(input: PdfInput): Promise<Buffer> };
  presentations: { generate(template: string, input: PresentationInput): Promise<Buffer> };
  logger?: Pick<Console, 'error'>;
}
import helmet from 'helmet';
import { randomUUID } from 'node:crypto';
import { ZodError } from 'zod';
import { AppError } from './errors.js';
import { pdfSchema, presentationSchema } from './schemas.js';
export function createApp({ pdf, presentations, logger = console }: Services) {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use((req, res, next) => { res.locals.requestId = randomUUID(); res.set('X-Request-Id', res.locals.requestId); next(); });
  app.use(express.json({ limit: '100kb' }));
  app.get('/health', (req, res) => res.json({ status: 'ok' }));
  app.post('/api/pdf', async (req, res) => {
    const input = pdfSchema.parse(req.body);
    const buffer = await pdf.generate(input);
    res.set('Cache-Control', 'no-store').attachment(`${input.filename}.pdf`).type('application/pdf').send(buffer);
  });
  app.post('/api/presentations/:template', async (req, res) => {
    const input = presentationSchema.parse(req.body);
    const buffer = await presentations.generate(req.params.template, input);
    res.set('Cache-Control', 'no-store').attachment(`${input.filename}.pptx`).type('application/vnd.openxmlformats-officedocument.presentationml.presentation').send(buffer);
  });
  app.use((req, res, next) => next(new AppError(404, 'NOT_FOUND', 'Endpoint not found')));
  const errorHandler: ErrorRequestHandler = (error, req, res, next) => {
    if (res.headersSent) return next(error);
    const validation = error instanceof ZodError;
    const status = validation ? 400 : error instanceof AppError ? error.status : error.type === 'entity.too.large' ? 413 : error.type === 'entity.parse.failed' ? 400 : 500;
    if (status >= 500) logger.error({ requestId: res.locals.requestId, error });
    res.status(status).json({ error: {
      code: validation ? 'VALIDATION_ERROR' : error instanceof AppError ? error.code : status === 400 ? 'INVALID_JSON' : status === 413 ? 'BODY_TOO_LARGE' : 'INTERNAL_ERROR',
      message: validation ? 'Invalid request parameters' : error instanceof AppError ? error.message : status === 400 ? 'Invalid JSON body' : status === 413 ? 'Request body is too large' : 'Document generation failed',
      ...(validation && { details: error.issues.map(({ path, message }) => ({ path, message })) }), requestId: res.locals.requestId,
    } });
  };
  app.use(errorHandler);
  return app;
}
