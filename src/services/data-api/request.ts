import { ErrorCode } from '@/constants';
import { AppError } from '@/errors';
import { QueueErrorMessage } from '@/queue/constants';

import { DataApiErrorMessage } from './constants.ts';

import type { z } from 'zod';
import type { Config } from '@/config';

/**
 * Applies one timeout to fetching and reading JSON, then validates the response.
 * Every failure carries the URL, status and cause in `details` for server logs.
 */
export async function requestDataApi<T>(
  url: URL,
  config: Pick<Config['dataApi'], 'token' | 'timeoutMs'>,
  schema: z.ZodType<T>,
  callerSignal?: AbortSignal,
): Promise<T> {
  const timeout = AbortSignal.timeout(config.timeoutMs);
  const signal = callerSignal ? AbortSignal.any([timeout, callerSignal]) : timeout;
  const started = performance.now();
  const context = () => ({
    url: url.href,
    timeoutMs: config.timeoutMs,
    elapsedMs: Math.round(performance.now() - started),
  });
  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        ...(config.token ? { Authorization: `Bearer ${config.token}` } : {}),
      },
      signal,
      redirect: 'manual',
    });
    if (!response.ok) {
      // Release the connection instead of leaving the unread body to GC.
      await response.body?.cancel().catch(() => {});
      throw new AppError(
        502,
        ErrorCode.DataApiHttpError,
        `Data API returned HTTP ${response.status}`,
        {
          details: {
            ...context(),
            status: response.status,
            statusText: response.statusText,
            location: response.headers.get('location'),
          },
        },
      );
    }
    let body: unknown;
    try {
      body = await response.json();
    } catch (error) {
      if (signal.aborted) throw error;
      throw new AppError(502, ErrorCode.DataApiInvalidResponse, DataApiErrorMessage.InvalidJson, {
        cause: error,
        details: { ...context(), contentType: response.headers.get('content-type') },
      });
    }
    const result = schema.safeParse(body);
    if (!result.success)
      throw new AppError(502, ErrorCode.DataApiInvalidResponse, DataApiErrorMessage.InvalidSchema, {
        details: {
          ...context(),
          issues: result.error.issues.map(({ path, message, code }) => ({ path, message, code })),
        },
      });
    return result.data;
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (callerSignal?.aborted)
      throw new AppError(499, ErrorCode.RequestCancelled, QueueErrorMessage.RequestCancelled, {
        cause: error,
        details: context(),
      });
    if (timeout.aborted)
      throw new AppError(504, ErrorCode.DataApiTimeout, DataApiErrorMessage.Timeout, {
        cause: error,
        details: context(),
      });
    throw new AppError(502, ErrorCode.DataApiUnavailable, DataApiErrorMessage.Unavailable, {
      cause: error,
      details: context(),
    });
  }
}
