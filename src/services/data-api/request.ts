import type { z } from 'zod';
import type { Config } from '@/config';
import { AppError } from '@/errors';

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
        'DATA_API_HTTP_ERROR',
        `Data API returned HTTP ${response.status}`,
      );
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      if (signal.aborted) throw signal.reason;
      throw new AppError(
        502,
        'DATA_API_INVALID_RESPONSE',
        'Data API returned invalid JSON',
      );
    }
    const result = schema.safeParse(body);
    if (!result.success)
      throw new AppError(
        502,
        'DATA_API_INVALID_RESPONSE',
        'Data API response does not match the expected schema',
      );
    return result.data;
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (signal.aborted)
      throw new AppError(504, 'DATA_API_TIMEOUT', 'Data API request timed out');
    throw new AppError(
      502,
      'DATA_API_UNAVAILABLE',
      'Unable to fetch data from the configured API',
    );
  }
}
