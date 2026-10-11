import { ZodError } from 'zod';

import { AppError } from '@/errors';

import type { ErrorRequestHandler } from 'express';

const parserErrors = new Map([
  [
    'entity.too.large',
    {
      status: 413,
      code: 'BODY_TOO_LARGE',
      message: 'Request body is too large',
    },
  ],
  [
    'entity.parse.failed',
    { status: 400, code: 'INVALID_JSON', message: 'Invalid JSON body' },
  ],
  [
    'charset.unsupported',
    {
      status: 415,
      code: 'UNSUPPORTED_CHARSET',
      message: 'Unsupported JSON charset',
    },
  ],
  [
    'encoding.unsupported',
    {
      status: 415,
      code: 'UNSUPPORTED_CONTENT_ENCODING',
      message: 'Unsupported content encoding',
    },
  ],
]);

/** Maps failures to the public error contract while keeping unexpected error details in server logs. */
export function createErrorHandler(
  logger: Pick<Console, 'error'>,
): ErrorRequestHandler {
  return (error, req, res, next) => {
    if (res.destroyed) return;
    if (res.headersSent) return next(error);
    const validation = error instanceof ZodError;
    const publicError = validation
      ? {
          status: 400,
          code: 'VALIDATION_ERROR',
          message: 'Invalid request parameters',
        }
      : error instanceof AppError
        ? error
        : (parserErrors.get(error?.type) ?? {
            status: 500,
            code: 'INTERNAL_ERROR',
            message: 'Document generation failed',
          });
    const { status, code, message } = publicError;
    if (status === 503) res.set('Retry-After', '5');
    if (status >= 500)
      logger.error({
        event: 'request_failed',
        requestId: res.locals.requestId,
        status,
        code,
      });
    res.status(status).json({
      error: {
        code,
        message,
        ...(validation && {
          details: error.issues.map(({ path, message }) => ({ path, message })),
        }),
        requestId: res.locals.requestId,
      },
    });
  };
}
