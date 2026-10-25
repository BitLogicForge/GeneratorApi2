import { ZodError } from 'zod';

import { ErrorCode } from '@/constants';
import { AppError } from '@/errors';
import { LogEvent } from '@/observability/constants';
import { serializeError } from '@/observability/serialize-error';

import { HttpErrorMessage, HttpHeader, ParserErrorType, UNMATCHED_ROUTE } from './constants.ts';

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

/**
 * Maps failures to the public error contract. Logs carry the full error chain;
 * 500 responses hide internal messages (paths, template object names) behind a generic one.
 */
export function createErrorHandler(
  logger: Pick<Console, 'error'> & Partial<Pick<Console, 'warn'>>,
): ErrorRequestHandler {
  return (error, req, res, next) => {
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
    const { status, code } = publicError;
    const context = {
      requestId: res.locals.requestId,
      method: req.method,
      route: typeof req.route?.path === 'string' ? req.route.path : UNMATCHED_ROUTE,
      url: req.originalUrl,
      status,
      code,
    };
    if (res.destroyed || res.headersSent) {
      logger.warn?.({
        event: LogEvent.RequestAbandoned,
        ...context,
        reason: res.destroyed ? 'client_disconnected' : 'headers_already_sent',
        error: serializeError(error),
      });
      return res.destroyed ? undefined : next(error);
    }
    if (status >= 500) {
      logger.error({ event: LogEvent.RequestFailed, ...context, error: serializeError(error) });
    } else {
      logger.warn?.({
        event: LogEvent.RequestRejected,
        ...context,
        message: publicError.message,
        ...(validation && {
          issues: error.issues.map(({ path, message, code }) => ({ path, message, code })),
        }),
        ...(error instanceof AppError && error.details && { details: error.details }),
      });
    }
    if (status === 503) res.set(HttpHeader.RetryAfter, '5');
    res.status(status).json({
      error: {
        code,
        message: status === 500 ? HttpErrorMessage.DocumentGenerationFailed : publicError.message,
        ...(validation && {
          details: error.issues.map(({ path, message }) => ({ path, message })),
        }),
        requestId: res.locals.requestId,
      },
    });
  };
}
