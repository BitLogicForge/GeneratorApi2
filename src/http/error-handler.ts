import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError } from '@/errors';

/** Maps failures to the public error contract while keeping unexpected error details in server logs. */
export function createErrorHandler(
  logger: Pick<Console, 'error'>,
): ErrorRequestHandler {
  return (error, req, res, next) => {
    if (res.destroyed) return;
    if (res.headersSent) return next(error);
    const validation = error instanceof ZodError;
    const status = validation
      ? 400
      : error instanceof AppError
        ? error.status
        : error.type === 'entity.too.large'
          ? 413
          : error.type === 'entity.parse.failed'
            ? 400
            : 500;
    if (status === 503) res.set('Retry-After', '5');
    if (status >= 500) logger.error({ requestId: res.locals.requestId, error });
    res.status(status).json({
      error: {
        code: validation
          ? 'VALIDATION_ERROR'
          : error instanceof AppError
            ? error.code
            : status === 400
              ? 'INVALID_JSON'
              : status === 413
                ? 'BODY_TOO_LARGE'
                : 'INTERNAL_ERROR',
        message: validation
          ? 'Invalid request parameters'
          : error instanceof AppError
            ? error.message
            : status === 400
              ? 'Invalid JSON body'
              : status === 413
                ? 'Request body is too large'
                : 'Document generation failed',
        ...(validation && {
          details: error.issues.map(({ path, message }) => ({ path, message })),
        }),
        requestId: res.locals.requestId,
      },
    });
  };
}
