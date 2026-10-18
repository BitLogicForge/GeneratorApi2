import { ZodError } from 'zod';

import { ErrorCode, ErrorMessage } from '@/constants';
import { AppError } from '@/errors';
import { LogEvent } from '@/observability/constants';

import { HttpHeader, ParserErrorType } from './constants.ts';

import type { ErrorRequestHandler } from 'express';

const parserErrors = new Map<
  string,
  { status: number; code: ErrorCode; message: string }
>([
  [
    ParserErrorType.EntityTooLarge,
    {
      status: 413,
      code: ErrorCode.BodyTooLarge,
      message: ErrorMessage.BodyTooLarge,
    },
  ],
  [
    ParserErrorType.EntityParseFailed,
    {
      status: 400,
      code: ErrorCode.InvalidJson,
      message: ErrorMessage.InvalidJson,
    },
  ],
  [
    ParserErrorType.CharsetUnsupported,
    {
      status: 415,
      code: ErrorCode.UnsupportedCharset,
      message: ErrorMessage.UnsupportedCharset,
    },
  ],
  [
    ParserErrorType.EncodingUnsupported,
    {
      status: 415,
      code: ErrorCode.UnsupportedContentEncoding,
      message: ErrorMessage.UnsupportedContentEncoding,
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
          code: ErrorCode.ValidationError,
          message: ErrorMessage.InvalidRequestParameters,
        }
      : error instanceof AppError
        ? error
        : (parserErrors.get(error?.type) ?? {
            status: 500,
            code: ErrorCode.InternalError,
            message: ErrorMessage.DocumentGenerationFailed,
          });
    const { status, code, message } = publicError;
    if (status === 503) res.set(HttpHeader.RetryAfter, '5');
    if (status >= 500)
      logger.error({
        event: LogEvent.RequestFailed,
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
