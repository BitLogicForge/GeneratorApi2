import type { z } from 'zod';
import type { Config } from '../config.js';
import { AppError } from '../errors.js';

export type DataApiQuery = Record<
  string,
  string | number | boolean | undefined
>;

/** Fetches validated JSON from the configured API, preserving its base path. */
export class DataApiClient {
  constructor(private readonly config: Config['dataApi']) {}

  async get<T>(
    path: string,
    query: DataApiQuery,
    schema: z.ZodType<T>,
  ): Promise<T> {
    if (!this.config.baseUrl)
      throw new AppError(
        503,
        'DATA_API_NOT_CONFIGURED',
        'Configure DATA_API_BASE_URL before fetching report data',
      );
    if (
      !path ||
      path.startsWith('//') ||
      /^[a-z][a-z0-9+.-]*:/i.test(path) ||
      /[\\?#\u0000-\u001f]/.test(path)
    )
      throw new AppError(
        400,
        'INVALID_DATA_API_PATH',
        'Use a relative data API path',
      );
    const base = new URL(this.config.baseUrl);
    base.pathname = `${base.pathname.replace(/\/$/, '')}/`;
    const url = new URL(path.replace(/^\//, ''), base);
    if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname))
      throw new AppError(
        400,
        'INVALID_DATA_API_PATH',
        'Path must stay within the configured data API',
      );
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined) continue;
      if (typeof value === 'number' && !Number.isFinite(value))
        throw new AppError(
          400,
          'INVALID_DATA_API_QUERY',
          'Numeric query values must be finite',
        );
      url.searchParams.set(key, String(value));
    }
    const signal = AbortSignal.timeout(this.config.timeoutMs);
    try {
      const response = await fetch(url, {
        headers: {
          Accept: 'application/json',
          ...(this.config.token
            ? { Authorization: `Bearer ${this.config.token}` }
            : {}),
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
      } catch (error) {
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
        throw new AppError(
          504,
          'DATA_API_TIMEOUT',
          'Data API request timed out',
        );
      throw new AppError(
        502,
        'DATA_API_UNAVAILABLE',
        'Unable to fetch data from the configured API',
      );
    }
  }
}
