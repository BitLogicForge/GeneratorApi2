import { ErrorCode } from '@/constants';
import { AppError } from '@/errors';

import { DataApiErrorMessage } from './constants.ts';

import type { z } from 'zod';
import type { Config } from '@/config';

/** Applies one timeout to fetching and reading JSON, then validates the response. */
export async function requestDataApi<T>(
  url: URL,
  config: Pick<Config['dataApi'], 'token' | 'timeoutMs'>,
  schema: z.ZodType<T>,
): Promise<T> {
  const signal = AbortSignal.timeout(config.timeoutMs);
  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        ...(config.token ? { Authorization: `Bearer ${config.token}` } : {}),
      },
      signal,
      redirect: 'manual',
    });
    if (!response.ok)
      throw new AppError(
        502,
        ErrorCode.DataApiHttpError,
        `Data API returned HTTP ${response.status}`,
      );
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      if (signal.aborted) throw signal.reason;
      throw new AppError(
        502,
        ErrorCode.DataApiInvalidResponse,
        DataApiErrorMessage.InvalidJson,
      );
    }
    const result = schema.safeParse(body);
    if (!result.success)
      throw new AppError(
        502,
        ErrorCode.DataApiInvalidResponse,
        DataApiErrorMessage.InvalidSchema,
      );
    return result.data;
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (signal.aborted)
      throw new AppError(
        504,
        ErrorCode.DataApiTimeout,
        DataApiErrorMessage.Timeout,
      );
    throw new AppError(
      502,
      ErrorCode.DataApiUnavailable,
      DataApiErrorMessage.Unavailable,
    );
  }
}
