import { ZodError } from 'zod';

import { ErrorCode } from '@/constants';
import { AppError } from '@/errors';
import { LogEvent } from '@/observability/constants';

import { HttpErrorMessage, HttpHeader, ParserErrorType } from './constants.ts';

import type { ErrorRequestHandler } from 'express';

const parserErrors = new Map<string, { status: number; code: ErrorCode; message: string }>([
  [
    ParserErrorType.EntityTooLarge,
    {
      status: 413,
      code: ErrorCode.BodyTooLarge,
      message: HttpErrorMessage.BodyTooLarge,
    },
  ],
  [
    ParserErrorType.EntityParseFailed,
    {
      status: 400,
      code: ErrorCode.InvalidJson,
      message: HttpErrorMessage.InvalidJson,
    },
  ],
  [
    ParserErrorType.CharsetUnsupported,
    {
      status: 415,
      code: ErrorCode.UnsupportedCharset,
      message: HttpErrorMessage.UnsupportedCharset,
    },
  ],
  [
    ParserErrorType.EncodingUnsupported,
    {
      status: 415,
      code: ErrorCode.UnsupportedContentEncoding,
      message: HttpErrorMessage.UnsupportedContentEncoding,
    },
  ],
]);

/** Maps failures to the public error contract while keeping unexpected error details in server logs. */
export function createErrorHandler(logger: Pick<Console, 'error'>): ErrorRequestHandler {
  return (error, req, res, next) => {
    if (res.destroyed) return;
    if (res.headersSent) return next(error);
    const validation = error instanceof ZodError;
    const publicError = validation
      ? {
          status: 400,
          code: ErrorCode.ValidationError,
          message: HttpErrorMessage.InvalidRequestParameters,
        }
      : error instanceof AppError
        ? error
        : (parserErrors.get(error?.type) ?? {
            status: 500,
            code: ErrorCode.InternalError,
            message: HttpErrorMessage.DocumentGenerationFailed,
          });
    const { status, code, message } = publicError;
    if (status === 503) res.set(HttpHeader.RetryAfter, '5');
    if (status >= 500)
      logger.error({
        event: LogEvent.RequestFailed,
        requestId: res.locals.requestId,
        status,
        code,
        ...(typeof res.locals.targetUrl === 'string' ? { targetUrl: res.locals.targetUrl } : {}),
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
