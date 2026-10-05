import express, { type ErrorRequestHandler } from 'express';
import type { PdfInput, PresentationInput, TemplatePresentationInput } from './schemas.js';
interface Services {
  pdf: { generate(input: PdfInput): Promise<Buffer> };
  presentations: { generate(template: string, input: PresentationInput): Promise<Buffer> };
  templatePresentations?: { generate(template: string, input: TemplatePresentationInput): Promise<Buffer> };
  pdfRoutePattern?: string;
  queues?: GenerationQueues;
  logger?: Pick<Console, 'error'>;
}
import helmet from 'helmet';
import { documentIdSchema, pdfRoutePatternSchema, pdfUrlQuerySchema, resolvePdfRoute } from './pdf-route.js';
import { createGenerationQueues, type GenerationQueues } from './queue/generation-queue.js';
import { randomUUID } from 'node:crypto';
import { ZodError } from 'zod';
import { AppError } from './errors.js';
import { pdfSchema, presentationSchema, templatePresentationSchema } from './schemas.js';
export function createApp({ pdf, presentations, logger = console, templatePresentations, pdfRoutePattern = '/documents/{id}', queues = createGenerationQueues() }: Services) {
  const routePattern = pdfRoutePatternSchema.parse(pdfRoutePattern);
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use((req, res, next) => { res.locals.requestId = randomUUID(); res.set('X-Request-Id', res.locals.requestId); next(); });
  app.use(express.json({ limit: '100kb' }));
  app.get('/health', (req, res) => res.json({ status: 'ok' }));
  const cancellation = (res: express.Response) => {
    const controller = new AbortController();
    const onClose = () => { if (!res.writableFinished) controller.abort(); };
    res.once('close', onClose);
    return { signal: controller.signal, cleanup: () => res.off('close', onClose) };
  };
  const sendPdf = async (input: PdfInput, res: express.Response) => {
    const request = cancellation(res);
    let buffer: Buffer;
    try { buffer = await queues.pdf.run(() => pdf.generate(input), request.signal); }
    finally { request.cleanup(); }
    if (res.destroyed) return;
    res.set('Cache-Control', 'no-store').attachment(`${input.filename}.pdf`).type('application/pdf').send(buffer);
  };
  app.get('/:id.pdf', async (req, res) => {
    const id = documentIdSchema.parse(req.params.id);
    const query = pdfUrlQuerySchema.parse(req.query);
    const route = resolvePdfRoute(routePattern, id);
    // Keep configured query keys authoritative, particularly the document ID.
    const target = new URL(route, 'http://webapp.invalid');
    for (const key of target.searchParams.keys()) {
      if (Object.hasOwn(query, key)) throw new AppError(400, 'RESERVED_QUERY_PARAMETER', `Query parameter is configured by the server: ${key}`);
    }
    await sendPdf(pdfSchema.parse({ route, query, filename: id }), res);
  });
  app.post('/api/pdf', async (req, res) => {
    await sendPdf(pdfSchema.parse(req.body), res);
  });
  app.post('/api/presentations/:template', async (req, res) => {
    const input = presentationSchema.parse(req.body);
    const request = cancellation(res);
    let buffer: Buffer;
    try { buffer = await queues.presentations.run(() => presentations.generate(req.params.template, input), request.signal); }
    finally { request.cleanup(); }
    if (res.destroyed) return;
    res.set('Cache-Control', 'no-store').attachment(`${input.filename}.pptx`).type('application/vnd.openxmlformats-officedocument.presentationml.presentation').send(buffer);
  });
  app.post('/api/presentation-templates/:template', async (req, res) => {
    const input = templatePresentationSchema.parse(req.body);
    if (!templatePresentations) throw new AppError(404, 'UNKNOWN_TEMPLATE', 'PowerPoint file template not found');
    const request = cancellation(res);
    let buffer: Buffer;
    try { buffer = await queues.presentations.run(() => templatePresentations.generate(req.params.template, input), request.signal); }
    finally { request.cleanup(); }
    if (res.destroyed) return;
    res.set('Cache-Control', 'no-store').attachment(`${input.filename}.pptx`)
      .type('application/vnd.openxmlformats-officedocument.presentationml.presentation').send(buffer);
  });
  app.use((req, res, next) => next(new AppError(404, 'NOT_FOUND', 'Endpoint not found')));
  const errorHandler: ErrorRequestHandler = (error, req, res, next) => {
    if (res.destroyed) return;
    if (res.headersSent) return next(error);
    const validation = error instanceof ZodError;
    const status = validation ? 400 : error instanceof AppError ? error.status : error.type === 'entity.too.large' ? 413 : error.type === 'entity.parse.failed' ? 400 : 500;
    if (status === 503) res.set('Retry-After', '5');
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
